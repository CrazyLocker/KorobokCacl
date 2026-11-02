// frontend/src/components/Calculations/OrderDrawer.tsx
import { useEffect, useMemo, useState } from 'react';
import {
    Alert, Button, Descriptions, Drawer, Flex, Form, Grid, Input, Select, Spin, Tag, Typography,
} from 'antd';
import type { CalculationOrder, OrderTree } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';
import { STATUS_COLORS, STATUS_LABELS, STATUS_OPTIONS } from '../../utils/calculationStatus';

interface Props {
    open: boolean;
    order: OrderTree | null;
    /** Открыть сразу в режиме правки (кнопка «Редактировать»). */
    startInEdit: boolean;
    onClose: () => void;
    onSaved: () => void;
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

const MONEY = new Intl.NumberFormat('ru-RU', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const money = (value?: number | null): string =>
    value == null ? '—' : `${MONEY.format(value)} ₽`;

/** Дата из `yyyy-mm-dd` — без сдвига часового пояса. */
const showDate = (value?: string | null): string => {
    if (!value) return '—';

    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
    return match ? `${match[3]}.${match[2]}.${match[1].slice(2)}` : value;
};

const inputDate = (value?: string | null): string => (value ?? '').slice(0, 10);

/**
 * Дровер заказа: тот же каркас, что у «Вида расчёта», — шапка с действиями,
 * просмотр описанием и переключение в правку.
 *
 * <p>Заказ не версия расчёта, а самостоятельная сущность, выросшая из версии:
 * источник показан только для чтения, менять его нельзя.
 */
export const OrderDrawer = ({
    open, order, startInEdit, onClose, onSaved, onNotify,
}: Props) => {
    const screens = Grid.useBreakpoint();
    const [form] = Form.useForm();
    const [full, setFull] = useState<CalculationOrder | null>(null);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editing, setEditing] = useState(startInEdit);
    const [error, setError] = useState<string | null>(null);

    // В дереве заказ приходит без комментария и имени клиента, поэтому
    // открываем карточку полной записью из справочника заказов клиента.
    useEffect(() => {
        if (!open || !order) return;

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

    const initialValues = useMemo(() => ({
        number: full?.number ?? order?.number ?? '',
        orderDate: inputDate(full?.orderDate ?? order?.orderDate),
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

    const number = full?.number ?? order?.number;

    return (
        <Drawer
            open={open}
            onClose={close}
            title={number ? `Заказ № ${number}` : 'Заказ'}
            size={screens.md ? 900 : '100%'}
            destroyOnHidden
            styles={{ body: { padding: 16 } }}
            extra={(
                <Flex gap={8}>
                    {editing ? (
                        <>
                            <Button onClick={() => setEditing(false)} disabled={saving}>
                                Отмена
                            </Button>
                            <Button type="primary" loading={saving} onClick={handleSave}>
                                Сохранить
                            </Button>
                        </>
                    ) : (
                        <Button
                            type="primary"
                            disabled={!full && loading}
                            onClick={() => setEditing(true)}
                        >
                            Редактировать
                        </Button>
                    )}
                </Flex>
            )}
        >
            {loading ? (
                <Flex justify="center" style={{ padding: 48 }}>
                    <Spin size="large" />
                </Flex>
            ) : (
                <Flex vertical gap={16}>
                    {error && <Alert type="warning" showIcon message={error} />}

                    {editing ? (
                        <Form form={form} layout="vertical" size="small" style={{ maxWidth: 560 }}>
                            <Form.Item
                                name="number"
                                label="Номер"
                                rules={[{ max: 50, message: 'Номер — не длиннее 50 символов' }]}
                            >
                                <Input placeholder="Пусто — присвоится автоматически" />
                            </Form.Item>
                            <Form.Item name="orderDate" label="Дата заказа">
                                <Input type="date" />
                            </Form.Item>
                            <Form.Item name="status" label="Статус">
                                <Select options={STATUS_OPTIONS} />
                            </Form.Item>
                            <Form.Item name="comment" label="Комментарий">
                                <Input.TextArea rows={3} maxLength={500} showCount />
                            </Form.Item>
                        </Form>
                    ) : (
                        <Descriptions
                            size="small"
                            bordered
                            column={screens.md ? 2 : 1}
                            items={[
                                {
                                    key: 'client',
                                    label: 'Клиент',
                                    children: full?.customerName || '—',
                                },
                                {
                                    key: 'status',
                                    label: 'Статус',
                                    children: (
                                        <Tag
                                            color={STATUS_COLORS[full?.status ?? 'draft']}
                                            style={{ marginInlineEnd: 0 }}
                                        >
                                            {STATUS_LABELS[full?.status ?? 'draft']}
                                        </Tag>
                                    ),
                                },
                                {
                                    key: 'orderDate',
                                    label: 'Дата заказа',
                                    children: showDate(full?.orderDate ?? order?.orderDate),
                                },
                                {
                                    key: 'totalCost',
                                    label: 'Себестоимость',
                                    children: money(full?.totalCost ?? order?.totalCost),
                                },
                                {
                                    key: 'source',
                                    label: 'Из версии',
                                    children: full?.sourceVersion != null
                                        ? `v${full.sourceVersion}`
                                            + (full.sourceCalculationName
                                                ? ` · ${full.sourceCalculationName}`
                                                : '')
                                        : '—',
                                },
                                {
                                    key: 'comment',
                                    label: 'Комментарий',
                                    children: full?.comment || '—',
                                },
                            ]}
                        />
                    )}

                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Источник заказа изменить нельзя: он фиксирует, из какой версии
                        расчёта вырос заказ. Цена и тираж зафиксированы в самой версии.
                    </Typography.Text>
                </Flex>
            )}
        </Drawer>
    );
};
