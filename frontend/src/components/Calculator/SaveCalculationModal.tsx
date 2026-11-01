// frontend/src/components/Calculator/SaveCalculationModal.tsx
import { useState } from 'react';
import { Alert, Button, Flex, Form, Input, Modal } from 'antd';
import { calculatorApi } from '../../api/calculatorApi';
import type { CalculationRequest, SavedCalculation } from '../../types';
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

/**
 * Сохранение расчёта: Ant Design Modal + Form.
 *
 * <p>Два режима в одной модалке:
 * <ul>
 *   <li>новый расчёт — форма метаданных и кнопка «Сохранить»;</li>
 *   <li>правка сохранённого — «Сохранить версию» (метаданные наследуются)
 *       и «Сохранить как новый» (нужна форма).</li>
 * </ul>
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
                clientName: values.clientName.trim(),
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
                >
                    <Input placeholder="Название клиента" data-testid="save-client" />
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
