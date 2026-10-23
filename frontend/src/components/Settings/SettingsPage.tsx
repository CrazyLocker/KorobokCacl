// frontend/src/components/Settings/SettingsPage.tsx
import { useEffect, useState } from 'react';
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import {
    App as AntdApp, Button, Card, Flex, Spin, Table, Tabs, Tag, Typography, Upload,
} from 'antd';
import type { SavedCalculation } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

type TabValue = 'calculations' | 'import';

const STATUS_LABELS: Record<SavedCalculation['status'], string> = {
    draft: 'Черновик',
    ready: 'Готов',
    sent: 'Отправлен',
    in_work: 'В работе',
    closed: 'Закрыт',
};

const STATUS_COLORS: Record<SavedCalculation['status'], string> = {
    draft: 'default',
    ready: 'processing',
    sent: 'warning',
    in_work: 'success',
    closed: 'red',
};

export const SettingsPage = ({ onNotify }: Props) => {
    const { modal } = AntdApp.useApp();
    const [activeTab, setActiveTab] = useState<TabValue>('calculations');

    // --- Импорт/экспорт JSON ---
    const handleImportFile = async (file: File | undefined, endpoint: string, label: string) => {
        if (!file) return;
        try {
            const text = await file.text();
            const json = JSON.parse(text);
            const res = await fetch(`/api/references/${endpoint}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(json),
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            onNotify(`${label}: импорт выполнен`, 'success');
        } catch (err: any) {
            onNotify(`Ошибка импорта (${label}): ${err.message}`, 'error');
        }
    };

    const handleExportCalculations = async () => {
        try {
            const data = await calculatorApi.listCalculations();
            const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `calculations-${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
            URL.revokeObjectURL(url);
            onNotify('Экспорт расчётов выполнен', 'success');
        } catch (err: any) {
            onNotify('Ошибка экспорта: ' + err.message, 'error');
        }
    };

    const downloadJson = (data: unknown, filename: string) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    // Экспорт конструкций (формат совместим с импортом: {название: {parts: {...}}})
    const handleExportConstructs = async () => {
        try {
            const constructs = await calculatorApi.getConstructs();
            const exportData: Record<string, any> = {};
            for (const c of constructs) {
                exportData[c.name] = {
                    description: c.description || '',
                    parts: c.parts?.parts?.reduce((acc: Record<string, number>, p) => {
                        acc[p.name] = p.perSheet;
                        return acc;
                    }, {}) || {},
                };
            }
            downloadJson(exportData, `constructs-${new Date().toISOString().slice(0, 10)}.json`);
            onNotify('Экспорт конструкций выполнен', 'success');
        } catch (err: any) {
            onNotify('Ошибка экспорта: ' + err.message, 'error');
        }
    };

    // Экспорт прайсов (формат совместим с импортом: {название конструкции: {диапазон: цена}})
    const handleExportPriceLists = async () => {
        try {
            const constructs = await calculatorApi.getConstructs();
            const exportData: Record<string, any> = {};
            for (const c of constructs) {
                const pl = await calculatorApi.getPriceList(c.id);
                if (pl?.priceData) {
                    exportData[c.name] = pl.priceData;
                }
            }
            downloadJson(exportData, `price-lists-${new Date().toISOString().slice(0, 10)}.json`);
            onNotify('Экспорт прайсов выполнен', 'success');
        } catch (err: any) {
            onNotify('Ошибка экспорта: ' + err.message, 'error');
        }
    };

    // Экспорт таблиц печати (формат совместим с импортом: {formatId: {name, steps, stepAfter3000}})
    const handleExportPrintTables = async () => {
        try {
            const tables = await calculatorApi.getPrintTables();
            const exportData: Record<string, any> = {};
            for (const t of tables) {
                exportData[String(t.formatId)] = {
                    name: t.formatName,
                    steps: t.steps,
                    stepAfter3000: t.stepAfter3000,
                };
            }
            downloadJson(exportData, `print-tables-${new Date().toISOString().slice(0, 10)}.json`);
            onNotify('Экспорт таблиц печати выполнен', 'success');
        } catch (err: any) {
            onNotify('Ошибка экспорта: ' + err.message, 'error');
        }
    };

    // --- Список расчётов ---
    const [calculations, setCalculations] = useState<SavedCalculation[]>([]);
    const [loading, setLoading] = useState(false);

    const loadCalculations = () => {
        setLoading(true);
        calculatorApi.listCalculations()
            .then(setCalculations)
            .catch((err) => onNotify('Ошибка загрузки расчётов: ' + err.message, 'error'))
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        loadCalculations();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Удаление расчёта: подтверждение через modal.confirm (App.useApp)
    const handleDeleteCalculation = (id: string) => {
        modal.confirm({
            title: 'Удаление расчёта',
            content: 'Удалить расчёт?',
            okText: 'Удалить',
            okButtonProps: { danger: true },
            cancelText: 'Отмена',
            onOk: async () => {
                try {
                    await calculatorApi.deleteCalculation(id);
                    setCalculations((prev) => prev.filter((c) => c.id !== id));
                    onNotify('Расчёт удалён', 'success');
                } catch (err: any) {
                    onNotify('Ошибка удаления: ' + err.message, 'error');
                }
            },
        });
    };

    return (
        <div style={{ flex: 1, minWidth: 0 }}>
            {/* Top bar */}
            <Card
                style={{
                    marginBottom: 16,
                    borderRadius: 16,
                    border: '1px solid #e8eaed',
                    backgroundColor: '#fff',
                    boxShadow: 'none',
                }}
                styles={{ body: { padding: '16px 24px' } }}
            >
                <Typography.Title level={5} style={{ fontSize: 18, margin: 0 }}>
                    Настройки
                </Typography.Title>
            </Card>

            {/* Tabs */}
            <div style={{ marginBottom: 16 }}>
                <Tabs
                    activeKey={activeTab}
                    onChange={(key) => setActiveTab(key as TabValue)}
                    items={[
                        { key: 'calculations', label: 'Расчёты' },
                        { key: 'import', label: 'Импорт / экспорт' },
                    ]}
                />
            </div>

            {/* Tab: Расчёты */}
            {activeTab === 'calculations' && (
                <Card
                    style={{
                        borderRadius: 12,
                        border: '1px solid #e8eaed',
                        overflow: 'hidden',
                        boxShadow: 'none',
                    }}
                    styles={{ body: { padding: 0 } }}
                >
                    <Flex justify="space-between" align="center" style={{ padding: 16, borderBottom: '1px solid #e8eaed' }}>
                        <Typography.Text strong style={{ fontSize: 14 }}>
                            Сохранённые расчёты
                        </Typography.Text>
                        <Button size="small" type="text" onClick={loadCalculations} style={{ fontSize: 12 }}>
                            Обновить
                        </Button>
                    </Flex>
                    {loading ? (
                        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
                            <Spin size="large" />
                        </div>
                    ) : calculations.length === 0 ? (
                        <Typography.Text style={{ display: 'block', padding: 24, fontSize: 13, color: '#9aa0a6' }}>
                            Нет сохранённых расчётов. Сохраните расчёт на странице калькулятора.
                        </Typography.Text>
                    ) : (
                        <Table
                            rowKey="id"
                            size="small"
                            pagination={false}
                            dataSource={calculations}
                            columns={[
                                {
                                    title: 'Название',
                                    dataIndex: 'name',
                                    key: 'name',
                                    render: (name: string) => <span style={{ fontSize: 13 }}>{name}</span>,
                                },
                                {
                                    title: 'Клиент',
                                    dataIndex: 'clientName',
                                    key: 'clientName',
                                    render: (v: string) => <span style={{ fontSize: 13 }}>{v}</span>,
                                },
                                {
                                    title: 'Менеджер',
                                    dataIndex: 'managerName',
                                    key: 'managerName',
                                    render: (v: string) => <span style={{ fontSize: 13 }}>{v}</span>,
                                },
                                {
                                    title: 'Статус',
                                    dataIndex: 'status',
                                    key: 'status',
                                    render: (_: unknown, c: SavedCalculation) => (
                                        <Tag
                                            color={STATUS_COLORS[c.status] || 'default'}
                                            style={{ fontSize: 11, height: 22, lineHeight: '20px' }}
                                        >
                                            {STATUS_LABELS[c.status] || c.status}
                                        </Tag>
                                    ),
                                },
                                {
                                    title: 'Создан',
                                    dataIndex: 'createdAt',
                                    key: 'createdAt',
                                    render: (v: string) => (
                                        <span style={{ fontSize: 12, color: '#5f6368' }}>
                                            {new Date(v).toLocaleString('ru-RU')}
                                        </span>
                                    ),
                                },
                                {
                                    title: '',
                                    key: 'actions',
                                    align: 'right',
                                    render: (_: unknown, c: SavedCalculation) => (
                                        <Button
                                            size="small"
                                            type="text"
                                            danger
                                            onClick={() => handleDeleteCalculation(c.id)}
                                            style={{ fontSize: 11 }}
                                        >
                                            Удалить
                                        </Button>
                                    ),
                                },
                            ]}
                        />
                    )}
                </Card>
            )}

            {/* Tab: Импорт / экспорт */}
            {activeTab === 'import' && (
                <Flex vertical>
                    {/* Конструкции */}
                    <Card
                        size="small"
                        style={{ marginBottom: 12, borderRadius: 12, border: '1px solid #e8eaed', boxShadow: 'none' }}
                        styles={{ body: { padding: '12px 16px' } }}
                    >
                        <Flex justify="space-between" align="center">
                            <Typography.Text strong>Конструкции</Typography.Text>
                            <Flex gap={8}>
                                <Upload
                                    accept=".json,application/json"
                                    showUploadList={false}
                                    beforeUpload={(file) => {
                                        handleImportFile(file, 'import-constructs', 'Конструкции');
                                        return false; // отменяем авто-загрузку antd — импорт делает handleImportFile
                                    }}
                                >
                                    <Button icon={<UploadOutlined />}>Загрузить</Button>
                                </Upload>
                                <Button
                                    type="primary"
                                    icon={<DownloadOutlined />}
                                    onClick={handleExportConstructs}
                                >
                                    Сохранить
                                </Button>
                            </Flex>
                        </Flex>
                    </Card>
                    {/* Прайс коробок */}
                    <Card
                        size="small"
                        style={{ marginBottom: 12, borderRadius: 12, border: '1px solid #e8eaed', boxShadow: 'none' }}
                        styles={{ body: { padding: '12px 16px' } }}
                    >
                        <Flex justify="space-between" align="center">
                            <Typography.Text strong>Прайс коробок</Typography.Text>
                            <Flex gap={8}>
                                <Upload
                                    accept=".json,application/json"
                                    showUploadList={false}
                                    beforeUpload={(file) => {
                                        handleImportFile(file, 'import-price-lists', 'Прайс коробок');
                                        return false; // отменяем авто-загрузку antd — импорт делает handleImportFile
                                    }}
                                >
                                    <Button icon={<UploadOutlined />}>Загрузить</Button>
                                </Upload>
                                <Button
                                    type="primary"
                                    icon={<DownloadOutlined />}
                                    onClick={handleExportPriceLists}
                                >
                                    Сохранить
                                </Button>
                            </Flex>
                        </Flex>
                    </Card>
                    {/* Прайс печати */}
                    <Card
                        size="small"
                        style={{ borderRadius: 12, border: '1px solid #e8eaed', boxShadow: 'none' }}
                        styles={{ body: { padding: '12px 16px' } }}
                    >
                        <Flex justify="space-between" align="center">
                            <Typography.Text strong>Прайс печати</Typography.Text>
                            <Flex gap={8}>
                                <Upload
                                    accept=".json,application/json"
                                    showUploadList={false}
                                    beforeUpload={(file) => {
                                        handleImportFile(file, 'import-print-tables', 'Прайс печати');
                                        return false; // отменяем авто-загрузку antd — импорт делает handleImportFile
                                    }}
                                >
                                    <Button icon={<UploadOutlined />}>Загрузить</Button>
                                </Upload>
                                <Button
                                    type="primary"
                                    icon={<DownloadOutlined />}
                                    onClick={handleExportPrintTables}
                                >
                                    Сохранить
                                </Button>
                            </Flex>
                        </Flex>
                    </Card>

                    {/* Все расчёты */}
                    <Card
                        size="small"
                        style={{ borderRadius: 12, border: '1px solid #e8eaed', boxShadow: 'none' }}
                        styles={{ body: { padding: '12px 16px' } }}
                    >
                        <Flex justify="space-between" align="center">
                            <Typography.Text strong>Все расчёты</Typography.Text>
                            <Button
                                type="primary"
                                icon={<DownloadOutlined />}
                                onClick={handleExportCalculations}
                            >
                                Сохранить
                            </Button>
                        </Flex>
                    </Card>
                </Flex>
            )}
        </div>
    );
};
