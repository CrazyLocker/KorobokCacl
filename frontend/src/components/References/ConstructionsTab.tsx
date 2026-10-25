// frontend/src/components/References/ConstructionsTab.tsx
import { useState, useCallback, useEffect } from 'react';
import {
    Alert, App as AntdApp, Button, Card, Flex, Input, InputNumber,
    Select, Spin, Table, Tag, Typography,
} from 'antd';
import type { Construct, Part } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';
import { sortConstructs } from '../../utils/sortConstructs';
import { sortParts } from '../../utils/sortParts';

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

/**
 * Детали конструкции в едином UI-порядке (см. sortParts): снизу вверх —
 * дно → разделитель → крышка; окно после крышки с окном (неотъемлемая часть);
 * шубер после крышки (заменитель). Кашированная: каркас → лайнер
 * (дно-каркас → дно-лайнер → обложка-каркас → обложка-лайнер-внеш. →
 * обложка-лайнер-внутр.). Неизвестные — в конец по алфавиту.
 * API отдаёт детали в произвольном порядке.
 */
const withSortedParts = (construct: Construct): Construct => ({
    ...construct,
    parts: sortParts(construct.parts ?? []),
});

export const ConstructionsTab = ({ onNotify }: Props) => {
    const { modal } = AntdApp.useApp();
    const [constructs, setConstructs] = useState<Construct[]>([]);
    const [selectedConstruct, setSelectedConstruct] = useState<string>('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    // Есть ли в текущей конструкции правки, ещё не отправленные на сервер
    const [dirty, setDirty] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Загрузка конструкций
    const loadConstructs = useCallback(() => {
        setLoading(true);
        setError(null);
        calculatorApi.getConstructs()
            .then((data) => {
                // Список в state держим в UI-порядке: класс → размер.
                // Детали внутри конструкции — тоже в UI-порядке (sortParts).
                const sorted = sortConstructs(data).map(withSortedParts);
                setConstructs(sorted);
                if (sorted.length > 0 && !selectedConstruct) {
                    setSelectedConstruct(sorted[0].id);
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
            // Существующая конструкция обновляется через PUT: сервис на сервере
            // загружает managed-сущность и проставляет в неё name/description/parts/isActive.
            const saved = selectedConstructData.id
                ? await calculatorApi.updateConstruct(selectedConstructData.id, selectedConstructData)
                : await calculatorApi.saveConstruct(selectedConstructData);

            // Приводим локальный список к ответу сервера, чтобы он не разошёлся с БД.
            // Пересортировываем: переименование могло сменить класс или размер,
            // а сервер может вернуть детали в порядке, отличном от UI.
            const savedWithSortedParts = withSortedParts(saved);
            setConstructs((prev) => sortConstructs(prev.some((c) => c.id === savedWithSortedParts.id)
                ? prev.map((c) => (c.id === savedWithSortedParts.id ? savedWithSortedParts : c))
                : [...prev, savedWithSortedParts]));
            setDirty(false);
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
                    setDirty(false);
                    onNotify('Конструкция удалена', 'success');
                } catch (err: any) {
                    onNotify('Ошибка удаления: ' + (err.response?.data?.message || err.message), 'error');
                }
            },
        });
    };

    // Добавить деталь
    // TODO: materialId — добавить выбор материала в форме детали.
    // Пока новая деталь наследует материал первой детали конструкции.
    const handleAddPart = () => {
        if (!selectedConstructData) {
            onNotify('Сначала выберите конструкцию', 'error');
            return;
        }

        const defaultMaterial = selectedConstructData.parts[0]?.material;
        if (!defaultMaterial) {
            onNotify('Сначала назначьте материал хотя бы одной детали', 'error');
            return;
        }

        const partName = prompt('Введите название новой детали:');
        if (!partName || !partName.trim()) return;

        const name = partName.trim();
        if (selectedConstructData.parts.some((p) => p.name === name)) {
            onNotify('Деталь с таким названием уже существует', 'error');
            return;
        }

        const newPart: Part = {
            id: crypto.randomUUID(),
            name,
            perSheet: 0,
            material: defaultMaterial,
        };
        const updated: Construct = {
            ...selectedConstructData,
            // Новая деталь сразу встаёт на своё место в едином порядке.
            parts: sortParts([...selectedConstructData.parts, newPart]),
        };

        setConstructs((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
        );
        setDirty(true);
        onNotify('Деталь добавлена', 'success');
    };

    // Удалить деталь из конструкции
    const handleRemovePart = (partName: string) => {
        if (!selectedConstructData) return;

        const updated: Construct = {
            ...selectedConstructData,
            parts: selectedConstructData.parts.filter((p) => p.name !== partName),
        };

        setConstructs((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
        );
        setDirty(true);
        onNotify('Деталь удалена', 'info');
    };

    // Обновить часть конструкции
    const handlePartChange = (partName: string, field: 'perSheet', value: number) => {
        if (!selectedConstructData) return;

        const updated: Construct = {
            ...selectedConstructData,
            parts: selectedConstructData.parts.map((p) =>
                p.name === partName ? { ...p, [field]: value } : p
            ),
        };

        setConstructs((prev) =>
            prev.map((c) => (c.id === updated.id ? updated : c))
        );
        setDirty(true);
    };

    // Переключение конструкции: несохранённые правки при этом теряются, поэтому спрашиваем
    const handleSelectChange = (value: string) => {
        if (!dirty) {
            setSelectedConstruct(value);
            return;
        }
        modal.confirm({
            title: 'Есть несохранённые изменения',
            content: 'Переключиться на другую конструкцию без сохранения?',
            okText: 'Переключиться',
            cancelText: 'Отмена',
            onOk: () => {
                setDirty(false);
                setSelectedConstruct(value);
            },
        });
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
                        onChange={handleSelectChange}
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
                            setDirty(true);
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
                    {dirty && (
                        <Tag color="orange" style={{ marginInlineEnd: 0 }}>Не сохранено</Tag>
                    )}
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
                        {selectedConstructData?.parts.length || 0} деталей
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
                        // tableLayout="fixed" — обязателен: только с ним width: '30ch'
                        // является жёсткой шириной колонки. В auto-layout браузер
                        // расширил бы колонку под max-content длинного имени.
                        tableLayout="fixed"
                        style={{ width: 'fit-content', maxWidth: '100%' }}
                        dataSource={selectedConstructData.parts}
                        columns={[
                            {
                                title: 'Деталь',
                                dataIndex: 'name',
                                key: 'name',
                                width: '30ch',
                                // ellipsis намеренно не используется: он обрезает текст
                                // (nowrap + text-overflow), а нужно переносить его
                                // внутри фиксированной ширины.
                                render: (name: string) => (
                                    <Typography.Text
                                        strong
                                        style={{
                                            fontSize: 13,
                                            whiteSpace: 'normal',
                                            wordBreak: 'break-word',
                                        }}
                                    >
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
                                render: (_: number, part: Part) => (
                                    <InputNumber
                                        value={part.perSheet}
                                        onChange={(value) => handlePartChange(part.name, 'perSheet', value ?? 0)}
                                        min={0}
                                        precision={0}
                                        step={1}
                                        controls={false}
                                        size="small"
                                        style={{ width: 56, backgroundColor: part.perSheet === 0 ? '#f8f9fa' : '#fff' }}
                                    />
                                ),
                            },
                            {
                                title: '',
                                key: 'actions',
                                width: 96,
                                align: 'center',
                                render: (_: unknown, part: Part) => (
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
