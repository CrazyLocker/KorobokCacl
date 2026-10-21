// frontend/src/components/References/PrintTablesTab.tsx
import { useState, useEffect } from 'react';
import {
    Alert, App as AntdApp, Button, Card, Flex, Input, InputNumber,
    Select, Spin, Table, Typography,
} from 'antd';
import type { PrintTable } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';

/** Шаг таблицы печати + стабильный клиентский ключ строки. */
type StepWithKey = PrintTable['steps'][number] & { uiKey: string };

/** PrintTable, шаги которой нормализованы uiKey (используется только в UI-состоянии). */
type PrintTableWithKeys = Omit<PrintTable, 'steps'> & { steps: StepWithKey[] };

let stepSequence = 0;

/**
 * Стабильный клиентский ключ шага: нужен как rowKey для antd Table и для
 * адресации правок вместо индекса (antd переиспользует строки при удалении/добавлении).
 * На backend не уходит — вырезается в handleSave.
 */
const createStepUiKey = (): string => `step-${Date.now().toString(36)}-${++stepSequence}`;

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

export const PrintTablesTab = ({ onNotify }: Props) => {
    const { modal } = AntdApp.useApp();
    const [printTables, setPrintTables] = useState<PrintTableWithKeys[]>([]);
    const [selectedFormat, setSelectedFormat] = useState<number | ''>('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Загрузка таблиц печати
    useEffect(() => {
        setLoading(true);
        calculatorApi.getPrintTables()
            .then((data) => {
                // Нормализуем шаги: каждому даём стабильный uiKey для antd rowKey
                const normalized: PrintTableWithKeys[] = data.map((t) => ({
                    ...t,
                    steps: t.steps.map((s) => ({ ...s, uiKey: createStepUiKey() })),
                }));
                setPrintTables(normalized);
                if (data.length > 0 && !selectedFormat) {
                    setSelectedFormat(data[0].formatId);
                }
            })
            .catch((err) => {
                setError('Ошибка загрузки: ' + err.message);
            })
            .finally(() => setLoading(false));
    }, []);

    const selectedTable = printTables.find((t) => t.formatId === selectedFormat);

    // Сохранение таблицы печати
    const handleSave = async () => {
        if (!selectedTable) {
            onNotify('Выберите формат', 'error');
            return;
        }
        setSaving(true);
        try {
            // uiKey — клиентский: перед отправкой вырезаем его из шагов
            const payload: PrintTable = {
                ...selectedTable,
                steps: selectedTable.steps.map((step) => ({ minQty: step.minQty, price: step.price })),
            };
            await calculatorApi.savePrintTable(payload);
            onNotify('Таблица печати сохранена', 'success');
        } catch (err: any) {
            onNotify('Ошибка сохранения: ' + (err.response?.data?.message || err.message), 'error');
        } finally {
            setSaving(false);
        }
    };

    // Удаление формата: подтверждение через modal.confirm (App.useApp)
    const handleDeleteClick = () => {
        if (!selectedTable) return;

        const { id, formatId, formatName } = selectedTable;

        modal.confirm({
            title: 'Удаление формата',
            content: `Удалить формат "${formatName}"?`,
            okText: 'Удалить',
            okButtonProps: { danger: true },
            cancelText: 'Отмена',
            onOk: async () => {
                try {
                    await calculatorApi.deletePrintTable(id);
                    // remaining — список уже без удалённого формата.
                    // Раньше здесь читался старый printTables (он ещё содержал удалённый формат).
                    const remaining = printTables.filter((t) => t.formatId !== formatId);
                    setPrintTables(remaining);
                    setSelectedFormat(remaining.length > 0 ? remaining[0].formatId : '');
                    onNotify('Формат удалён', 'success');
                } catch (err: any) {
                    onNotify('Ошибка удаления: ' + (err.response?.data?.message || err.message), 'error');
                }
            },
        });
    };

    // Добавить шаг
    const handleAddStep = () => {
        if (!selectedTable) {
            onNotify('Сначала выберите формат', 'error');
            return;
        }
        const lastStep = selectedTable.steps[selectedTable.steps.length - 1];
        const newQty = lastStep ? lastStep.minQty * 2 : 100;
        const newPrice = lastStep ? lastStep.price + 1000 : 5500;

        const updated = {
            ...selectedTable,
            steps: [...selectedTable.steps, { minQty: newQty, price: newPrice, uiKey: createStepUiKey() }],
        };

        setPrintTables((prev) => prev.map((t) => (t.formatId === updated.formatId ? updated : t)));
        onNotify('Шаг добавлен', 'success');
    };

    // Обновить шаг (адресуем по uiKey, а не по индексу строки)
    const handleStepChange = (uiKey: string, field: 'minQty' | 'price', value: number) => {
        if (!selectedTable) return;

        const updatedSteps = selectedTable.steps.map((step) =>
            step.uiKey === uiKey ? { ...step, [field]: value } : step
        );

        const updated = { ...selectedTable, steps: updatedSteps };
        setPrintTables((prev) => prev.map((t) => (t.formatId === updated.formatId ? updated : t)));
    };

    // Удалить шаг (по uiKey, а не по индексу строки)
    const handleDeleteStep = (uiKey: string) => {
        if (!selectedTable) return;

        const updatedSteps = selectedTable.steps.filter((step) => step.uiKey !== uiKey);
        const updated = { ...selectedTable, steps: updatedSteps };
        setPrintTables((prev) => prev.map((t) => (t.formatId === updated.formatId ? updated : t)));
        onNotify('Шаг удалён', 'success');
    };

    return (
        <div>
            {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} />}

            {/* Конструктор */}
            <Card
                style={{
                    marginBottom: 16,
                    borderRadius: 12,
                    border: '1px solid #e8eaed',
                    backgroundColor: '#f8f9fa',
                    boxShadow: 'none',
                }}
                styles={{ body: { padding: 16 } }}
            >
                <Typography.Text
                    style={{
                        display: 'block',
                        fontSize: 12,
                        color: '#5f6368',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                    }}
                >
                    Формат печати
                </Typography.Text>
                <Flex gap={16} wrap="wrap" align="center">
                    <Select
                        value={selectedFormat || undefined}
                        onChange={(value) => setSelectedFormat(value)}
                        options={printTables.map((t) => ({ value: t.formatId, label: t.formatName }))}
                        placeholder="Выберите формат"
                        style={{ minWidth: 200 }}
                    />
                    <Input
                        value={selectedTable?.formatName || ''}
                        onChange={(e) => {
                            if (!selectedTable) return;
                            const updated = { ...selectedTable, formatName: e.target.value };
                            setPrintTables((prev) => prev.map((t) => (t.formatId === updated.formatId ? updated : t)));
                        }}
                        placeholder="Название"
                        style={{ minWidth: 200, maxWidth: 260 }}
                    />
                    <Button
                        size="small"
                        onClick={handleSave}
                        loading={saving}
                        style={{
                            borderColor: '#137333',
                            color: '#137333',
                            fontSize: 12,
                            borderRadius: 20,
                        }}
                    >
                        Сохранить
                    </Button>
                    <Button
                        size="small"
                        danger
                        onClick={handleDeleteClick}
                        disabled={!selectedTable}
                        style={{
                            borderColor: '#d93025',
                            color: '#d93025',
                            fontSize: 12,
                            borderRadius: 20,
                        }}
                    >
                        Удалить
                    </Button>
                </Flex>
            </Card>

            {/* Таблица шагов */}
            <Card style={{ borderRadius: 12, border: '1px solid #e8eaed', overflow: 'hidden', boxShadow: 'none' }} styles={{ body: { padding: 0 } }}>
                <Flex justify="space-between" align="center" style={{ padding: 16, paddingBottom: 8, borderBottom: '1px solid #e8eaed' }}>
                    <Typography.Text
                        strong
                        style={{
                            fontSize: 14,
                            color: '#202124',
                            paddingBottom: 8,
                            borderBottom: '2px solid #1a73e8',
                            flex: 1,
                            textAlign: 'left',
                        }}
                    >
                        Стоимость печати по форматам
                    </Typography.Text>
                    <Typography.Text
                        style={{
                            fontSize: 10,
                            fontWeight: 500,
                            backgroundColor: '#1a73e8',
                            color: '#fff',
                            padding: '2px 16px',
                            borderRadius: 16,
                        }}
                    >
                        {selectedTable?.steps.length || 0} шагов
                    </Typography.Text>
                </Flex>

                {loading ? (
                    <div style={{ padding: 32, textAlign: 'center' }}>
                        <Spin size="large" />
                    </div>
                ) : !selectedTable ? (
                    <div style={{ padding: 32, textAlign: 'center', color: '#9aa0a6' }}>
                        Выберите формат
                    </div>
                ) : (
                    <Table
                        rowKey="uiKey"
                        size="small"
                        pagination={false}
                        dataSource={selectedTable.steps}
                        columns={[
                            {
                                title: 'Мин. тираж',
                                dataIndex: 'minQty',
                                key: 'minQty',
                                align: 'center',
                                width: 120,
                                render: (_: number, step: StepWithKey) => (
                                    <InputNumber
                                        value={step.minQty}
                                        onChange={(value) => handleStepChange(step.uiKey, 'minQty', value ?? 0)}
                                        min={0}
                                        step={1}
                                        size="small"
                                        style={{ width: 50 }}
                                    />
                                ),
                            },
                            {
                                title: 'Цена (₽)',
                                dataIndex: 'price',
                                key: 'price',
                                align: 'center',
                                width: 120,
                                render: (_: number, step: StepWithKey) => (
                                    <InputNumber
                                        value={step.price}
                                        onChange={(value) => handleStepChange(step.uiKey, 'price', value ?? 0)}
                                        min={0}
                                        step={1}
                                        size="small"
                                        style={{ width: 50 }}
                                    />
                                ),
                            },
                            {
                                title: '',
                                key: 'actions',
                                width: 40,
                                align: 'center',
                                render: (_: unknown, step: StepWithKey) => (
                                    <Button
                                        size="small"
                                        type="text"
                                        danger
                                        onClick={() => handleDeleteStep(step.uiKey)}
                                        style={{ color: '#d93025', opacity: 0.5 }}
                                    >
                                        Удалить
                                    </Button>
                                ),
                            },
                        ]}
                    />
                )}

                {/* Действия */}
                <Flex gap={12} wrap="wrap" align="center" style={{ padding: 16, borderTop: '1px solid #e8eaed' }}>
                    <Button
                        size="small"
                        onClick={handleAddStep}
                        disabled={!selectedTable}
                        style={{
                            borderColor: '#1a73e8',
                            color: '#1a73e8',
                            fontSize: 12,
                            borderRadius: 20,
                        }}
                    >
                        Добавить шаг
                    </Button>
                </Flex>
            </Card>
        </div>
    );
};
