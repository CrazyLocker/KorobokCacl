// frontend/src/components/Calculator/SaveCalculationModal.tsx
import { useEffect, useMemo, useState } from 'react';
import { Alert, AutoComplete, Button, Checkbox, Divider, Flex, Form, Input, Modal } from 'antd';
import { calculatorApi } from '../../api/calculatorApi';
import type { CalculationRequest, Customer, SavedCalculation } from '../../types';
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
 * неизвестное имя бэкенд заводит сам. Заказ можно создать сразу здесь: он
 * вырастет из сохраняемой версии, поэтому его источник — только что сохранённый
 * расчёт, а не отдельный выбор «привязать к заказу».
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
    // «Заказ из этой версии» — необязательный шаг сразу после сохранения.
    const [withOrder, setWithOrder] = useState(false);
    const [orderNumber, setOrderNumber] = useState('');
    const [orderDate, setOrderDate] = useState(() => new Date().toISOString().slice(0, 10));
    const clientName = Form.useWatch('clientName', form) ?? '';

    useEffect(() => {
        if (!open) return;
        void calculatorApi.listCustomers()
            .then(setCustomers)
            .catch(() => setCustomers([]));
    }, [open]);

    /** Клиент, уже заведённый в справочнике: по нему сохраняется customerId. */
    const matchedCustomer = useMemo(() => {
        if (!clientName.trim()) return null;
        return customers.find((customer) => sameName(customer.name, clientName)) ?? null;
    }, [clientName, customers]);

    const customerOptions = customers
        .filter((customer) => customer.active)
        .map((customer) => ({ value: customer.name }));

    const toRequest = (): CalculationRequest => ({
        ...calculation,
        // UI-ключи строк не должны попадать в JSON запроса.
        details: toApiDetails(calculation.details),
    });

    /**
     * Заказ из только что сохранённой версии.
     *
     * <p>Ошибка заказа не отменяет сохранение расчёта: расчёт уже в базе, поэтому
     * сообщаем отдельно и оставляем пользователю возможность повторить из дерева.
     */
    const createOrderFor = async (saved: SavedCalculation) => {
        if (!withOrder) return;

        try {
            const order = await calculatorApi.createOrder({
                sourceCalculationId: saved.id,
                number: orderNumber.trim() || null,
                orderDate,
                status: 'draft',
            });
            onNotify(`Заказ № ${order.number} создан из v${saved.version ?? 1}`, 'success');
        } catch (error: unknown) {
            onNotify('Расчёт сохранён, но заказ не создан: ' + apiErrorMessage(error), 'error');
        }
    };

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
                managerName: values.managerName.trim(),
                calculation: toRequest(),
            });
            onNotify('Расчёт сохранён', 'success');
            await createOrderFor(saved);
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
            await createOrderFor(saved);
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
            afterClose={() => {
                form.resetFields();
                setWithOrder(false);
                setOrderNumber('');
            }}
        >
            {restored && (
                <Alert
                    type="info"
                    showIcon
                    style={{ marginBottom: 16 }}
                    message="Расчёт открыт на правку"
                    description={'Название, клиент и менеджер наследуются от версии, которую редактируете. '
                        + 'Из любой версии в дереве можно создать заказ. '
                        + 'Остальные изменённые значения применяются только при сохранении как нового расчёта.'}
                />
            )}
            <Form<SaveFormValues>
                form={form}
                layout="vertical"
                requiredMark={false}
                style={{ marginTop: restored ? 0 : 16 }}
                initialValues={restored
                    ? {
                        name: restored.name,
                        clientName: restored.clientName,
                        managerName: restored.managerName,
                    }
                    : undefined}
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
                    label="Менеджер"
                    name="managerName"
                    rules={[{ required: true, whitespace: true, message: 'Укажите менеджера' }]}
                >
                    <Input placeholder="ФИО менеджера" data-testid="save-manager" />
                </Form.Item>
            </Form>
            <Divider style={{ margin: '16px 0 12px' }} />
            <Flex vertical gap={8}>
                <Checkbox
                    checked={withOrder}
                    disabled={saving}
                    onChange={(event) => setWithOrder(event.target.checked)}
                >
                    Создать заказ из этой версии
                </Checkbox>
                {withOrder && (
                    <Flex gap={8} wrap>
                        <Input
                            placeholder="Номер заказа (пусто — присвоится автоматически)"
                            value={orderNumber}
                            disabled={saving}
                            onChange={(event) => setOrderNumber(event.target.value)}
                            style={{ flex: 1, minWidth: 220 }}
                            data-testid="save-order-number"
                        />
                        <Input
                            type="date"
                            value={orderDate}
                            disabled={saving}
                            onChange={(event) => setOrderDate(event.target.value)}
                            style={{ width: 150 }}
                        />
                    </Flex>
                )}
                {withOrder && (
                    <span style={{ fontSize: 11, color: '#9aa0a6' }}>
                        Заказ появится в дереве у клиента с подписью «из vN», статус — «Черновик».
                    </span>
                )}
            </Flex>
            {restored && (
                <Flex vertical gap={4} style={{ fontSize: 12, color: '#9aa0a6' }}>
                    <span>Редактируется версия: v{restored.version ?? 1}</span>
                    <span>Клиент: {restored.clientName} · Менеджер: {restored.managerName}</span>
                </Flex>
            )}
        </Modal>
    );
};
