// frontend/src/components/Calculations/OrderModal.tsx
import { useEffect, useMemo, useState } from 'react';
import {
    Alert, Button, Descriptions, Flex, Form, Input, Modal, Select, Spin, Typography,
} from 'antd';
import type { CalculationOrder, OrderTree, SavedCalculation } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';

interface Props {
    open: boolean;
    order: OrderTree | null;
    /** Открыть сразу в режиме правки (кнопка «Редактировать»). */
    startInEdit: boolean;
    onClose: () => void;
    onSaved: () => void;
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

const STATUS_LABELS: Record<SavedCalculation['status'], string> = {
    draft: 'Черновик',
    ready: 'Готов',
    sent: 'Отправлен',
    in_work: 'В работе',
    closed: 'Закрыт',
};

const STATUS_OPTIONS = (Object.keys(STATUS_LABELS) as SavedCalculation['status'][])
    .map((value) => ({ value, label: STATUS_LABELS[value] }));

const MONEY = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const money = (value?: number | null): string =>
    value == null ? '—' : `${MONEY.format(value)} ₽`;

/**
 * Карточка заказа: просмотр и правка номера, даты, статуса и комментария.
 *
 * <p>Заказ — не версия расчёта, а отдельная сущность, которая выросла из
 * версии: источник показан read-only, менять его нельзя (иначе заказ потеряет
 * происхождение).
 */
export const OrderModal = ({
    open, order, startInEdit, onClose, onSaved, onNotify,
}: Props) => {
    const [form] = Form.useForm();
    const [full, setFull] = useState<CalculationOrder | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(startInEdit);
    const [error, setError] = useState<string | null>(null);

    // В дереве заказ приходит без комментария и имени клиента, поэтому
    // открываем карточку полной записью из справочника заказов клиента.
    useEffect(() => {
        if (!open || !order) {
            return;
        }

        setEditing(startInEdit);
        setError(null);
        setLoading(true);

        calculatorApi.listOrders(order.customerId ?? undefined)
            .then((orders) => {
                const found = orders.find((item) => item.id === order.id);
                setFull(found ?? null);
                if (!found) {
                    setError('Заказ не найден в справочнике — возможно, он удалён.');
                }
            })
            .catch((err: Error) => setError('Ошибка загрузки заказа: ' + err.message))
            .finally(() => setLoading(false));
    }, [open, order, startInEdit]);

    // Форма живёт значениями записи из справочника, но при отсутствии загрузки
    // берём то, что уже есть в дереве — так карточка не пустует.
    const initialValues = useMemo(() => ({
        number: full?.number ?? order?.number ?? '',
        orderDate: (full?.orderDate ?? order?.orderDate ?? '').slice(0, 10),
        status: full?.status ?? order?.status ?? 'draft',
        comment: full?.comment ?? '',
    }), [full, order]);

    useEffect(() => {
        if (open && !loading) {
            form.setFieldsValue(initialValues);
        }
    }, [open, loading, initialValues, form]);

    const handleSave = async () => {
        if (!full) return;

        try {
            const values = await form.validateFields();
            setSaving(true);
            await calculatorApi.updateOrder(full.id, {
                sourceCalculationId: full.sourceCalculationId ?? '',
                number: values.number?.trim() || null,
                orderDate: values.orderDate || null,
                status: values.status,
                comment: values.comment?.trim() || null,
            });
            onNotify(`Заказ № ${values.number?.trim() || full.number} обновлён`, 'success');
            onSaved();
            setEditing(false);
        } catch (err) {
            if (err && typeof err === 'object' && 'errorFields' in err) {
                return; // ошибки валидации формы уже показаны под полями
            }
            onNotify('Ошибка сохранения заказа: ' + (err as Error).message, 'error');
        } finally {
            setSaving(false);
        }
    };

    const close = () => {
        setFull(null);
        setError(null);
        onClose();
    };

    const title = full?.number ?? order?.number;

    return (
        <Modal
            open={open}
            title={title ? `Заказ № ${title}` : 'Заказ'}
            onCancel={close}
            destroyOnHidden
            width={560}
            footer={[
                <Button key="close" onClick={close}>Закрыть</Button>,
                ...(editing
                    ? [<Button key="save" type="primary" loading={saving} onClick={handleSave}>
                        Сохранить
                    </Button>]
                    : [<Button key="edit" type="primary" onClick={() => setEditing(true)}>
                        Редактировать
                    </Button>]),
            ]}
        >
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                    <Spin />
                </div>
            ) : (
                <Flex vertical gap={12}>
                    {error && <Alert type="warning" showIcon message={error} />}

                    <Descriptions column={1} size="small" bordered={false}
                        labelStyle={{ width: 150, fontSize: 12, color: '#5f6368' }}
                        contentStyle={{ fontSize: 13 }}>
                        <Descriptions.Item label="Клиент">
                            {full?.customerName ?? '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Из версии">
                            {full?.sourceVersion != null
                                ? `v${full.sourceVersion}${full.sourceCalculationName
                                    ? ` · ${full.sourceCalculationName}` : ''}`
                                : '—'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Себестоимость">
                            {money(full?.totalCost ?? order?.totalCost)}
                        </Descriptions.Item>
                    </Descriptions>

                    <Form form={form} layout="vertical" disabled={!editing} size="small">
                        <Flex gap={8} wrap>
                            <Form.Item name="number" label="Номер" style={{ flex: 1, minWidth: 180 }}
                                rules={[{ max: 50, message: 'Номер — не длиннее 50 символов' }]}>
                                <Input placeholder="Пусто — присвоится автоматически" />
                            </Form.Item>
                            <Form.Item name="orderDate" label="Дата заказа" style={{ width: 160 }}>
                                <Input type="date" />
                            </Form.Item>
                        </Flex>
                        <Form.Item name="status" label="Статус">
                            <Select options={STATUS_OPTIONS} />
                        </Form.Item>
                        <Form.Item name="comment" label="Комментарий">
                            <Input.TextArea rows={2} maxLength={500} showCount />
                        </Form.Item>
                    </Form>

                    {!editing && (
                        <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                            Источник заказа изменить нельзя: он фиксирует, из какой версии
                            расчёта вырос заказ.
                        </Typography.Text>
                    )}
                </Flex>
            )}
        </Modal>
    );
};
