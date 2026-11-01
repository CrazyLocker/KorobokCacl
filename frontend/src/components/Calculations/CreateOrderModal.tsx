// frontend/src/components/Calculations/CreateOrderModal.tsx
import { useEffect, useState } from 'react';
import {
    Alert, Descriptions, Form, Input, Modal, Select, Typography,
} from 'antd';
import type { CalculationVersion, SavedCalculation } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';

interface Props {
    open: boolean;
    /** Версия, из которой создаётся заказ; null — модалка закрыта. */
    version: CalculationVersion | null;
    onClose: () => void;
    /** Заказ создан: страница перезагружает дерево. */
    onCreated: (orderNumber: string) => void;
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

interface FormValues {
    number?: string;
    orderDate: string;
    status: SavedCalculation['status'];
    comment?: string;
}

const STATUS_OPTIONS: Array<{ value: SavedCalculation['status']; label: string }> = [
    { value: 'draft', label: 'Черновик' },
    { value: 'ready', label: 'Готов' },
    { value: 'sent', label: 'Отправлен' },
    { value: 'in_work', label: 'В работе' },
    { value: 'closed', label: 'Закрыт' },
];

/** Дата в формате input type="date": yyyy-MM-dd. */
const today = (): string => new Date().toISOString().slice(0, 10);

/**
 * Создание заказа из выбранной версии расчёта.
 *
 * <p>Заказ растёт из версии: клиент, стоимость и состав берутся из неё, а сам
 * расчёт остаётся в дереве клиента и может дать ещё один заказ позже.
 */
export const CreateOrderModal = ({
    open, version, onClose, onCreated, onNotify,
}: Props) => {
    const [form] = Form.useForm<FormValues>();
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!open) return;
        form.setFieldsValue({ number: undefined, orderDate: today(), status: 'draft', comment: undefined });
    }, [open, form]);

    const handleOk = async () => {
        if (!version) return;
        const values = await form.validateFields();
        setSaving(true);
        try {
            const order = await calculatorApi.createOrder({
                sourceCalculationId: version.id,
                number: values.number?.trim() || null,
                orderDate: values.orderDate,
                status: values.status,
                comment: values.comment?.trim() || null,
            });
            onNotify(`Заказ № ${order.number} создан из v${version.version}`, 'success');
            onCreated(order.number);
            onClose();
        } catch (err) {
            onNotify('Ошибка создания заказа: ' + (err as Error).message, 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            title="Новый заказ из версии расчёта"
            okText="Создать заказ"
            cancelText="Отмена"
            confirmLoading={saving}
            onOk={handleOk}
            onCancel={onClose}
            destroyOnHidden
        >
            {version && (
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 12 }}
                    message={`Заказ вырастет из v${version.version}`}
                    description={`Клиент: ${version.clientName}. Версия останется в дереве: из неё можно будет сделать ещё один заказ.`}
                />
            )}
            <Descriptions size="small" column={1} style={{ marginBottom: 12 }}>
                <Descriptions.Item label="Расчёт">{version?.name ?? '—'}</Descriptions.Item>
                <Descriptions.Item label="Себестоимость версии">
                    {version?.totalCost == null
                        ? '—'
                        : `${version.totalCost.toFixed(2)} ₽`}
                </Descriptions.Item>
            </Descriptions>
            <Form form={form} layout="vertical" requiredMark={false}>
                <Form.Item
                    name="number"
                    label="Номер заказа"
                    extra={<Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Оставьте пустым — номер вида 2026-001 сгенерируется автоматически.
                    </Typography.Text>}
                >
                    <Input placeholder="автоматически" maxLength={50} />
                </Form.Item>
                <Form.Item
                    name="orderDate"
                    label="Дата заказа"
                    rules={[{ required: true, message: 'Укажите дату заказа' }]}
                >
                    <Input type="date" />
                </Form.Item>
                <Form.Item name="status" label="Статус" rules={[{ required: true }]}>
                    <Select options={STATUS_OPTIONS} />
                </Form.Item>
                <Form.Item name="comment" label="Комментарий">
                    <Input.TextArea rows={2} maxLength={500} placeholder="Что важно помнить по заказу" />
                </Form.Item>
            </Form>
        </Modal>
    );
};
