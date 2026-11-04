// frontend/src/components/References/CustomersTab.tsx
import { useCallback, useEffect, useState } from 'react';
import {
    App as AntdApp,
    Button,
    Flex,
    Form,
    Input,
    Modal,
    Space,
    Switch,
    Table,
    Tag,
    Typography,
} from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { calculatorApi } from '../../api/calculatorApi';
import type { Customer, CustomerSaveRequest } from '../../types';

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

interface CustomerFormValues {
    name: string;
    inn?: string;
    contact?: string;
    active: boolean;
}

/**
 * Справочник клиентов: имена уникальны без учёта регистра, поэтому менеджер не
 * заводит «Ромашка» и «ромашка» как разных клиентов. Переименование
 * подтягивается в уже сохранённые расчёты этого клиента.
 */
export const CustomersTab = ({ onNotify }: Props) => {
    const { modal } = AntdApp.useApp();
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [loading, setLoading] = useState(false);
    const [editing, setEditing] = useState<Customer | null>(null);
    const [formOpen, setFormOpen] = useState(false);
    const [saving, setSaving] = useState(false);
    const [form] = Form.useForm<CustomerFormValues>();

    const load = useCallback(async () => {
        setLoading(true);
        try {
            setCustomers(await calculatorApi.listCustomers());
        } catch (error) {
            onNotify(`Не удалось загрузить клиентов: ${(error as Error).message}`, 'error');
        } finally {
            setLoading(false);
        }
    }, [onNotify]);

    useEffect(() => {
        void load();
    }, [load]);

    const openCreate = () => {
        setEditing(null);
        form.setFieldsValue({ name: '', inn: '', contact: '', active: true });
        setFormOpen(true);
    };

    const openEdit = (customer: Customer) => {
        setEditing(customer);
        form.setFieldsValue({
            name: customer.name,
            inn: customer.inn ?? '',
            contact: customer.contact ?? '',
            active: customer.active,
        });
        setFormOpen(true);
    };

    const submit = async () => {
        const values = await form.validateFields();
        const payload: CustomerSaveRequest = {
            name: values.name.trim(),
            inn: values.inn?.trim() || null,
            contact: values.contact?.trim() || null,
            active: values.active,
        };
        setSaving(true);
        try {
            if (editing) {
                await calculatorApi.updateCustomer(editing.id, payload);
                onNotify(`Клиент «${payload.name}» обновлён`);
            } else {
                await calculatorApi.createCustomer(payload);
                onNotify(`Клиент «${payload.name}» добавлен`);
            }
            setFormOpen(false);
            await load();
        } catch (error) {
            onNotify((error as Error).message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const deactivate = (customer: Customer) => {
        modal.confirm({
            title: `Скрыть клиента «${customer.name}»?`,
            content: 'Клиент пропадёт из выбора в новых расчётах, сохранённые расчёты останутся.',
            okText: 'Скрыть',
            cancelText: 'Отмена',
            onOk: async () => {
                try {
                    await calculatorApi.updateCustomer(customer.id, {
                        name: customer.name,
                        inn: customer.inn,
                        contact: customer.contact,
                        active: false,
                    });
                    onNotify(`Клиент «${customer.name}» скрыт`);
                    await load();
                } catch (error) {
                    onNotify((error as Error).message, 'error');
                }
            },
        });
    };

    const columns: ColumnsType<Customer> = [
        {
            title: 'Клиент',
            dataIndex: 'name',
            render: (name: string, record) => (
                <Space size={8}>
                    <Typography.Text strong>{name}</Typography.Text>
                    {!record.active && <Tag>Скрыт</Tag>}
                </Space>
            ),
        },
        { title: 'ИНН', dataIndex: 'inn', width: 160, render: (value: string | null) => value || '—' },
        {
            title: 'Контакт',
            dataIndex: 'contact',
            width: 260,
            render: (value: string | null) => value || '—',
        },
        {
            title: '',
            key: 'actions',
            width: 190,
            render: (_: unknown, record) => (
                <Space size={8}>
                    <Button size="small" onClick={() => openEdit(record)}>
                        Редактировать
                    </Button>
                    {record.active && (
                        <Button size="small" danger onClick={() => deactivate(record)}>
                            Скрыть
                        </Button>
                    )}
                </Space>
            ),
        },
    ];

    return (
        <>
            <Flex justify="space-between" align="center" style={{ marginBottom: 12, gap: 12 }}>
                <Typography.Text type="secondary">
                    Клиент — обязательный атрибут расчёта: по нему собирается история заказов.
                </Typography.Text>
                <Space>
                    <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={loading}>
                        Обновить
                    </Button>
                    <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
                        Добавить клиента
                    </Button>
                </Space>
            </Flex>

            <Table<Customer>
                rowKey="id"
                size="small"
                loading={loading}
                dataSource={customers}
                columns={columns}
                pagination={false}
                locale={{ emptyText: 'Клиентов пока нет' }}
            />

            <Modal
                open={formOpen}
                title={editing ? 'Клиент' : 'Новый клиент'}
                okText={editing ? 'Сохранить' : 'Добавить'}
                cancelText="Отмена"
                confirmLoading={saving}
                onOk={() => void submit()}
                onCancel={() => setFormOpen(false)}
                destroyOnHidden
            >
                <Form form={form} layout="vertical" requiredMark={false}>
                    <Form.Item
                        name="name"
                        label="Название"
                        rules={[{ required: true, message: 'Укажите название клиента' }]}
                    >
                        <Input placeholder="ООО «Ромашка»" autoFocus />
                    </Form.Item>
                    <Form.Item name="inn" label="ИНН">
                        <Input placeholder="Необязательно" />
                    </Form.Item>
                    <Form.Item name="contact" label="Контакт">
                        <Input placeholder="Телефон, e-mail или имя" />
                    </Form.Item>
                    <Form.Item name="active" label="Активен" valuePropName="checked">
                        <Switch />
                    </Form.Item>
                </Form>
            </Modal>
        </>
    );
};
