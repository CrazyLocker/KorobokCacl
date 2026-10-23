// frontend/src/components/Calculator/SaveCalculationModal.tsx
import { useState } from 'react';
import { Form, Input, Modal } from 'antd';
import axios from 'axios';
import { calculatorApi } from '../../api/calculatorApi';
import type { CalculationRequest } from '../../types';
import { toApiDetails } from '../../utils/calculationRequest';

interface Props {
    open: boolean;
    onClose: () => void;
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
    calculation: CalculationRequest;
}

interface SaveFormValues {
    name: string;
    clientName: string;
    managerName: string;
}

const apiErrorMessage = (error: unknown): string => {
    if (axios.isAxiosError<{ message?: string }>(error)) {
        return error.response?.data?.message || error.message;
    }
    return error instanceof Error ? error.message : String(error);
};

/** Сохранение расчёта: Ant Design Modal + Form. Все три поля обязательны. */
export const SaveCalculationModal = ({ open, onClose, onNotify, calculation }: Props) => {
    const [form] = Form.useForm<SaveFormValues>();
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        let values: SaveFormValues;
        try {
            values = await form.validateFields();
        } catch {
            return;
        }

        setSaving(true);
        try {
            await calculatorApi.saveCalculation({
                name: values.name.trim(),
                clientName: values.clientName.trim(),
                managerName: values.managerName.trim(),
                // UI-ключи строк не должны попадать в JSON запроса.
                calculation: { ...calculation, details: toApiDetails(calculation.details) },
            });
            onNotify('Расчёт сохранён', 'success');
            onClose();
        } catch (error: unknown) {
            onNotify('Ошибка сохранения: ' + apiErrorMessage(error), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Modal
            open={open}
            title="Сохранить расчёт"
            okText="Сохранить"
            cancelText="Отмена"
            confirmLoading={saving}
            closable={!saving}
            mask={{ closable: !saving }}
            onOk={handleSave}
            onCancel={() => {
                if (!saving) onClose();
            }}
            afterClose={() => form.resetFields()}
        >
            <Form<SaveFormValues>
                form={form}
                layout="vertical"
                requiredMark={false}
                style={{ marginTop: 16 }}
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
        </Modal>
    );
};
