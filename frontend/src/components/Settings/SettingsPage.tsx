// frontend/src/components/Settings/SettingsPage.tsx
import { DownloadOutlined, UploadOutlined } from '@ant-design/icons';
import { Button, Card, Flex, Typography, Upload } from 'antd';
import { calculatorApi } from '../../api/calculatorApi';
import { sortParts } from '../../utils/sortParts';
import { PurgeBlock } from './PurgeBlock';

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

/**
 * Настройки: служебный обмен данными (импорт / экспорт JSON).
 *
 * <p>Список сохранённых расчётов живёт на отдельной странице «Сохранённые
 * расчёты» — здесь остаются только выгрузки справочников и расчётов.
 */
export const SettingsPage = ({ onNotify }: Props) => {
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

    const downloadJson = (data: unknown, filename: string) => {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
    };

    const handleExportCalculations = async () => {
        try {
            const data = await calculatorApi.listCalculations();
            downloadJson(data, `calculations-${new Date().toISOString().slice(0, 10)}.json`);
            onNotify('Экспорт расчётов выполнен', 'success');
        } catch (err: any) {
            onNotify('Ошибка экспорта: ' + err.message, 'error');
        }
    };

    // Экспорт конструкций: {название: {description, parts: [{name, perSheet, pricePerSheet}]}}
    const handleExportConstructs = async () => {
        try {
            const constructs = await calculatorApi.getConstructs();
            const exportData: Record<string, any> = {};
            for (const c of constructs) {
                exportData[c.name] = {
                    description: c.description || '',
                    // Детали в едином UI-порядке, а не в порядке из API.
                    parts: sortParts(c.parts || []).map((p) => ({
                        name: p.name,
                        perSheet: p.perSheet,
                        pricePerSheet: p.pricePerSheet ?? 0,
                    })),
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
                <Flex vertical gap={2}>
                    <Typography.Title level={5} style={{ fontSize: 18, margin: 0 }}>
                        Настройки
                    </Typography.Title>
                    <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                        Обмен данными и очистка базы от помеченных записей
                    </Typography.Text>
                </Flex>
            </Card>

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
                    style={{ marginBottom: 12, borderRadius: 12, border: '1px solid #e8eaed', boxShadow: 'none' }}
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

            <PurgeBlock onNotify={onNotify} />
        </div>
    );
};
