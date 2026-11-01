// frontend/src/components/Calculator/SaveCalculationModal.tsx
import { useEffect, useMemo, useState } from 'react';
import { Alert, AutoComplete, Button, Divider, Flex, Form, Input, Modal, Select, Space } from 'antd';
import { PlusOutlined } from '@ant-design/icons';
import { calculatorApi } from '../../api/calculatorApi';
import type { CalculationOrder, CalculationRequest, Customer, SavedCalculation } from '../../types';
import type { RestoredCalculation } from '../../hooks/useCalculator';
import { toApiDetails } from '../../utils/calculationRequest';

interface Props {
    open: boolean;
    onClose: () => void;
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
    calculation: CalculationRequest;
    /** Расчёт открыт на правку: сохранение создаёт следующую версию. */
    restored?: RestoredCalculation | null;
    /** Сохранённый результат: калькулятор продолжает уже эту версию. */
    onSaved?: (saved: SavedCalculation) => void;
}

interface SaveFormValues {
    name: string;
    clientName: string;
    managerName: string;
    orderId?: string | null;
}

/** Текст ошибки уже переведён интерсептором axios (см. api/calculatorApi.ts). */
const apiErrorMessage = (error: unknown): string =>
    error instanceof Error && error.message ? error.message : 'Не удалось сохранить расчёт';

/** Сравнение имён клиентов без учёта регистра и лишних пробелов. */
const sameName = (left: string, right: string): boolean =>
    left.trim().toLowerCase() === right.trim().toLowerCase();

/**
 * Сохранение расчёта: Ant Design Modal + Form.
 *
 * <p>Два режима в одной модалке:
 * <ul>
 *   <li>новый расчёт — форма метаданных и кнопка «Сохранить»;</li>
 *   <li>правка сохранённого — «Сохранить версию» (метаданные наследуются)
 *       и «Сохранить как новый» (нужна форма).</li>
 * </ul>
 *
 * <p>Клиент — справочная величина: имя подсказывается из справочника, а
 * неизвестное имя бэкенд заводит сам. Заказ выбирается из заказов выбранного
 * клиента, новый можно создать прямо в выпадающем списке.
 */
export const SaveCalculationModal = ({
    open,
    onClose,
    onNotify,
    calculation,
    restored,
    onSaved,
}: Props) => {
    const [form] = Form.useForm<SaveFormValues>();
    const [saving, setSaving] = useState(false);
    const [customers, setCustomers] = useState<Customer[]>([]);
    const [orders, setOrders] = useState<CalculationOrder[]>([]);
    const [orderDraft, setOrderDraft] = useState('');
    const [creatingOrder, setCreatingOrder] = useState(false);
    const clientName = Form.useWatch('clientName', form) ?? '';

    useEffect(() => {
        if (!open) return;
        void calculatorApi.listCustomers()
            .then(setCustomers)
            .catch(() => setCustomers([]));
        void calculatorApi.listOrders()
            .then(setOrders)
            .catch(() => setOrders([]));
    }, [open]);

    /** Клиент, уже заведённый в справочнике: по нему фильтруются заказы. */
    const matchedCustomer = useMemo(() => {
        if (!clientName.trim()) return null;
        return customers.find((customer) => sameName(customer.name, clientName)) ?? null;
    }, [clientName, customers]);

    const customerOptions = customers
        .filter((customer) => customer.active)
        .map((customer) => ({ value: customer.name }));

    const orderOptions = orders
        .filter((order) => matchedCustomer && order.customerId === matchedCustomer.id)
        .map((order) => ({
            value: order.id,
            label: `№ ${order.number} · ${new Date(order.orderDate).toLocaleDateString('ru-RU')}`,
        }));

    const createOrder = async () => {
        if (!matchedCustomer) {
            onNotify('Сначала укажите клиента из справочника', 'error');
            return;
        }
        setCreatingOrder(true);
        try {
            const created = await calculatorApi.createOrder({
                customerId: matchedCustomer.id,
                number: orderDraft.trim() || null,
            });
            setOrders((previous) => [created, ...previous]);
            form.setFieldValue('orderId', created.id);
            setOrderDraft('');
            onNotify(`Заказ № ${created.number} создан`);
        } catch (error) {
            onNotify((error as Error).message, 'error');
        } finally {
            setCreatingOrder(false);
        }
    };

    const toRequest = (): CalculationRequest => ({
        ...calculation,
        // UI-ключи строк не должны попадать в JSON запроса.
        details: toApiDetails(calculation.details),
    });

    // --- Сохранение как отдельный расчёт ---
    const handleSaveAsNew = async () => {
        let values: SaveFormValues;
        try {
            values = await form.validateFields();
        } catch {
            return;
        }

        setSaving(true);
        try {
            const saved = await calculatorApi.saveCalculation({
                name: values.name.trim(),
                customerId: matchedCustomer?.id ?? null,
                clientName: values.clientName.trim(),
                orderId: values.orderId ?? null,
                managerName: values.managerName.trim(),
                calculation: toRequest(),
            });
            onNotify('Расчёт сохранён', 'success');
            onSaved?.(saved);
            onClose();
        } catch (error: unknown) {
            onNotify('Ошибка сохранения: ' + apiErrorMessage(error), 'error');
        } finally {
            setSaving(false);
        }
    };

    // --- Сохранение правки как новой версии ---
    const handleSaveVersion = async () => {
        if (!restored) return;

        setSaving(true);
        try {
            const saved = await calculatorApi.iterateCalculation(restored.id, toRequest());
            onNotify(
                saved.version ? `Сохранена версия ${saved.version}` : 'Сохранена новая версия',
                'success',
            );
            onSaved?.(saved);
            onClose();
        } catch (error: unknown) {
            // Отказ калькулятора (неполный расчёт) — версия не создана.
            onNotify('Ошибка сохранения: ' + apiErrorMessage(error), 'error');
        } finally {
            setSaving(false);
        }
    };

    const footer = restored
        ? [
            <Button key="cancel" onClick={() => { if (!saving) onClose(); }} disabled={saving}>
                Отмена
            </Button>,
            <Button key="new" onClick={handleSaveAsNew} loading={saving}>
                Сохранить как новый
            </Button>,
            <Button key="version" type="primary" onClick={handleSaveVersion} loading={saving}>
                Сохранить версию
            </Button>,
        ]
        : undefined;

    return (
        <Modal
            open={open}
            title={restored
                ? `Новая версия расчёта${restored.version ? ` (на основе v${restored.version})` : ''}`
                : 'Сохранить расчёт'}
            okText="Сохранить"
            cancelText="Отмена"
            confirmLoading={saving}
            closable={!saving}
            mask={{ closable: !saving }}
            destroyOnHidden
            onOk={restored ? handleSaveVersion : handleSaveAsNew}
            onCancel={() => {
                if (!saving) onClose();
            }}
            footer={footer}
            afterClose={() => form.resetFields()}
        >
            {restored && (
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Расчёт открыт на правку"
                    description={'Название, клиент и менеджер наследуются от версии, которую редактируете. '
                        + 'Изменённые значения применяются только при сохранении как нового расчёта.'}
                />
            )}
            <Form<SaveFormValues>
                form={form}
                layout="vertical"
                requiredMark={false}
                style={{ marginTop: restored ? 0 : 16 }}
                initialValues={restored ?? undefined}
            >
                <Form.Item
                    label="Название расчёта"
                    name="name"
                    rules={[{ required: true, whitespace: true, message: 'Укажите название расчёта' }]}
                >
                    <Input autoFocus placeholder="Например, коробка для часов" data-testid="save-name" />
                </Form.Item>
                <Form.Item
                    label="Клиент"
                    name="clientName"
                    rules={[{ required: true, whitespace: true, message: 'Укажите клиента' }]}
                    tooltip="Клиент ведётся справочником: неизвестное имя будет заведено автоматически"
                >
                    <AutoComplete
                        options={customerOptions}
                        filterOption={(input, option) =>
                            (option?.value ?? '').toLowerCase().includes(input.toLowerCase())}
                        placeholder="Название клиента"
                        data-testid="save-client"
                    >
                        <Input placeholder="Название клиента" suffix={matchedCustomer ? '✓' : undefined} />
                    </AutoComplete>
                </Form.Item>
                <Form.Item
                    label="Заказ"
                    name="orderId"
                    tooltip={matchedCustomer
                        ? 'Заказы выбранного клиента'
                        : 'Сначала укажите клиента из справочника, чтобы выбрать его заказ'}
                >
                    <Select
                        allowClear
                        placeholder={matchedCustomer ? 'Без заказа' : 'Сначала укажите клиента'}
                        disabled={!matchedCustomer}
                        options={orderOptions}
                        notFoundContent={matchedCustomer ? 'У клиента пока нет заказов' : null}
                        popupRender={(menu) => (
                            <>
                                {menu}
                                <Divider style={{ margin: '8px 0' }} />
                                <Space.Compact style={{ width: '100%', padding: '0 8px 4px' }}>
                                    <Input
                                        value={orderDraft}
                                        onChange={(event) => setOrderDraft(event.target.value)}
                                        placeholder="Новый заказ: номер"
                                        onKeyDown={(event) => event.stopPropagation()}
                                    />
                                    <Button
                                        type="primary"
                                        icon={<PlusOutlined />}
                                        loading={creatingOrder}
                                        disabled={!matchedCustomer}
                                        onClick={() => void createOrder()}
                                    >
                                        Создать
                                    </Button>
                                </Space.Compact>
                            </>
                        )}
                    />
                </Form.Item>
                <Form.Item
                    label="Менеджер"
                    name="managerName"
                    rules={[{ required: true, whitespace: true, message: 'Укажите менеджера' }]}
                >
                    <Input placeholder="ФИО менеджера" data-testid="save-manager" />
                </Form.Item>
            </Form>
            {restored && (
                <Flex vertical gap={4} style={{ fontSize: 12, color: '#9aa0a6' }}>
                    <span>Редактируется версия: v{restored.version ?? 1}</span>
                    <span>Клиент: {restored.clientName} · Менеджер: {restored.managerName}</span>
                </Flex>
            )}
        </Modal>
    );
};
