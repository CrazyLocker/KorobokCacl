// frontend/src/components/References/ConstructionsTab.tsx
import { useState, useCallback, useEffect } from 'react';
import {
    Alert, App as AntdApp, Button, Card, Flex, Input, InputNumber,
    Select, Spin, Table, Typography,
} from 'antd';
import type { Construct } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

export const ConstructionsTab = ({ onNotify }: Props) => {
    const { modal } = AntdApp.useApp();
    const [constructs, setConstructs] = useState<Construct[]>([]);
    const [selectedConstruct, setSelectedConstruct] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Загрузка конструкций
    const loadConstructs = useCallback(() => {
        setLoading(true);
        setError(null);
        calculatorApi.getConstructs()
            .then((data) => {
                setConstructs(data);
                if (data.length > 0 && !selectedConstruct) {
                    setSelectedConstruct(data[0].id);
                }
            })
            .catch((err) => {
                setError('Ошибка загрузки конструкций: ' + err.message);
                onNotify('Ошибка загрузки конструкций', 'error');
            })
            .finally(() => setLoading(false));
    }, [selectedConstruct, onNotify]);

    useEffect(() => {
        loadConstructs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const selectedConstructData = constructs.find((c) => c.id === selectedConstruct);

    // Сохранение конструкции
    const handleSave = async () => {
        if (!selectedConstructData) {
            onNotify('Выберите конструкцию', 'error');
            return;
        }
        setSaving(true);
        try {
            await calculatorApi.saveConstruct(selectedConstructData);
            onNotify('Конструкция сохранена', 'success');
        } catch (err: any) {
            onNotify('Ошибка сохранения: ' + (err.response?.data?.message || err.message), 'error');
        } finally {
            setSaving(false);
        }
    };

    // Удаление конструкции
    const handleDelete = () => {
        if (!selectedConstruct) return;
        modal.confirm({
            title: 'Удалить конструкцию?',
            content: `Удалить конструкцию "${selectedConstructData?.name}"?`,
            okText: 'Удалить',
            okButtonProps: { danger: true },
            cancelText: 'Отмена',
            onOk: async () => {
                try {
                    await calculatorApi.deleteConstruct(selectedConstruct);
                    const remaining = constructs.filter((c) => c.id !== selectedConstruct);
                    setConstructs(remaining);
                    setSelectedConstruct(remaining.length > 0 ? remaining[0].id : '');
                    onNotify('Конструкция удалена', 'success');
                } catch (err: any) {
                    onNotify('Ошибка удаления: ' + (err.response?.data?.message || err.message), 'error');
                }
            },
        });
    };

    // Добавить деталь
    const handleAddPart = () => {
        if (!selectedConstructData) {
            onNotify('Сначала выберите конструкцию', 'error');
            return;
        }
        const partName = prompt('Введите название новой детали:');
        if (!partName || !partName.trim()) return;

        const name = partName.trim();
        if (selectedConstructData.parts.parts.some((p) => p.name === name)) {
            onNotify('Деталь с таким названием уже существует', 'error');
            return;
        }

        const updated = {
            ...selectedConstructData,
            parts: {
                ...selectedConstructData.parts,
                parts: [
                    ...selectedConstructData.parts.parts,
                    { name, perSheet: 0 },
                ],
            },
        };

        setConstructs((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
        );
        onNotify('Деталь добавлена', 'success');
    };

    // Удалить деталь из конструкции
    const handleRemovePart = (partName: string) => {
        if (!selectedConstructData) return;

        const updated = {
            ...selectedConstructData,
            parts: {
                ...selectedConstructData.parts,
                parts: selectedConstructData.parts.parts.filter((p) => p.name !== partName),
            },
        };

        setConstructs((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
        );
        onNotify('Деталь удалена (не забудьте сохранить)', 'info');
    };

    // Обновить часть конструкции
    const handlePartChange = (partName: string, field: 'perSheet', value: number) => {
        if (!selectedConstructData) return;

        const updated = {
            ...selectedConstructData,
            parts: {
                ...selectedConstructData.parts,
                parts: selectedConstructData.parts.parts.map((p) =>
                    p.name === partName ? { ...p, [field]: value } : p
                ),
            },
        };

        setConstructs((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
        );
    };

    return (
        <div>
            {error && <Alert type="error" title={error} style={{ marginBottom: 16 }} />}

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
                        fontSize: 12,
                        color: '#5f6368',
                        display: 'block',
                        marginBottom: 8,
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                    }}
                >
                    Конструкция
                </Typography.Text>
                <Flex gap={16} wrap="wrap" align="center">
                    <Select
                        value={selectedConstruct || undefined}
                        onChange={(value) => setSelectedConstruct(value)}
                        options={constructs.map((c) => ({ value: c.id, label: c.name }))}
                        placeholder="Выберите конструкцию"
                        style={{ minWidth: 200 }}
                    />
                    <Input
                        value={selectedConstructData?.name || ''}
                        onChange={(e) => {
                            if (!selectedConstructData) return;
                            const updated = { ...selectedConstructData, name: e.target.value };
                            setConstructs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
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
                            fontSize: '12px',
                            borderRadius: '20px',
                        }}
                    >
                        Сохранить
                    </Button>
                    <Button
                        size="small"
                        danger
                        onClick={handleDelete}
                        disabled={!selectedConstruct}
                        style={{
                            borderColor: '#d93025',
                            color: '#d93025',
                            fontSize: '12px',
                            borderRadius: '20px',
                        }}
                    >
                        Удалить
                    </Button>
                </Flex>
            </Card>

            {/* Таблица деталей */}
            <Card
                style={{ borderRadius: 12, border: '1px solid #e8eaed', overflow: 'hidden', boxShadow: 'none' }}
                styles={{ body: { padding: 0 } }}
            >
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
                        Параметры раскладки деталей
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
                        {selectedConstructData?.parts.parts.length || 0} деталей
                    </Typography.Text>
                </Flex>

                {loading ? (
                    <div style={{ padding: 32, textAlign: 'center' }}>
                        <Spin />
                    </div>
                ) : !selectedConstructData ? (
                    <div style={{ padding: 32, textAlign: 'center', color: '#9aa0a6' }}>
                        Выберите конструкцию
                    </div>
                ) : (
                    <Table
                        rowKey="name"
                        size="small"
                        pagination={false}
                        dataSource={selectedConstructData.parts.parts}
                        columns={[
                            {
                                title: 'Деталь',
                                dataIndex: 'name',
                                key: 'name',
                                render: (name: string) => (
                                    <Typography.Text strong style={{ fontSize: 13 }}>
                                        {name}
                                    </Typography.Text>
                                ),
                            },
                            {
                                title: 'шт./лист',
                                dataIndex: 'perSheet',
                                key: 'perSheet',
                                align: 'center',
                                width: 80,
                                render: (_: number, part: { name: string; perSheet: number }) => (
                                    <InputNumber
                                        value={part.perSheet}
                                        onChange={(value) => handlePartChange(part.name, 'perSheet', value ?? 0)}
                                        min={0}
                                        step={0.001}
                                        size="small"
                                        style={{ width: 50, backgroundColor: part.perSheet === 0 ? '#f8f9fa' : '#fff' }}
                                    />
                                ),
                            },
                            {
                                title: '',
                                key: 'actions',
                                width: 40,
                                align: 'center',
                                render: (_: unknown, part: { name: string; perSheet: number }) => (
                                    <Button
                                        size="small"
                                        type="text"
                                        danger
                                        onClick={() => handleRemovePart(part.name)}
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
                        onClick={handleAddPart}
                        disabled={!selectedConstructData}
                        style={{
                            borderColor: '#1a73e8',
                            color: '#1a73e8',
                            fontSize: '12px',
                            borderRadius: '20px',
                        }}
                    >
                        Добавить деталь
                    </Button>
                </Flex>
            </Card>
        </div>
    );
};
