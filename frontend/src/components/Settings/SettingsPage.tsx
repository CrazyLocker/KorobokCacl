// frontend/src/components/Settings/SettingsPage.tsx
import { useEffect, useRef, useState } from 'react';
import {
    Box,
    Paper,
    Typography,
    Tabs,
    Tab,
    Button,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    CircularProgress,
} from '@mui/material';
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

const STATUS_COLORS: Record<SavedCalculation['status'], 'default' | 'primary' | 'success' | 'warning' | 'error'> = {
    draft: 'default',
    ready: 'primary',
    sent: 'warning',
    in_work: 'success',
    closed: 'error',
};

export const SettingsPage = ({ onNotify }: Props) => {
    const [activeTab, setActiveTab] = useState<TabValue>('calculations');

    // --- Импорт/экспорт JSON ---
    const constructsInputRef = useRef<HTMLInputElement>(null);
    const priceInputRef = useRef<HTMLInputElement>(null);
    const printInputRef = useRef<HTMLInputElement>(null);

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

    const handleDeleteCalculation = async (id: string) => {
        if (!confirm('Удалить расчёт?')) return;
        try {
            await calculatorApi.deleteCalculation(id);
            setCalculations((prev) => prev.filter((c) => c.id !== id));
            onNotify('Расчёт удалён', 'success');
        } catch (err: any) {
            onNotify('Ошибка удаления: ' + err.message, 'error');
        }
    };

    return (
        <Box sx={{ flex: 1, minWidth: 0 }}>
            {/* Top bar */}
            <Paper
                elevation={0}
                sx={{
                    p: '16px 24px',
                    mb: 2,
                    borderRadius: '16px',
                    border: '1px solid #e8eaed',
                    backgroundColor: '#fff',
                }}
            >
                <Typography variant="h6" sx={{ fontSize: '18px', fontWeight: 500 }}>
                    Настройки
                </Typography>
            </Paper>

            {/* Tabs */}
            <Box sx={{ mb: 2 }}>
                <Tabs
                    value={activeTab}
                    onChange={(_: React.SyntheticEvent, v: TabValue) => setActiveTab(v)}
                    sx={{
                        backgroundColor: '#f1f3f4',
                        borderRadius: '12px',
                        '& .MuiTab-root': {
                            textTransform: 'none',
                            fontWeight: 500,
                            fontSize: '13px',
                            minHeight: '44px',
                            borderRadius: '10px',
                            color: '#5f6368',
                            '&.Mui-selected': {
                                backgroundColor: '#fff',
                                color: '#1a73e8',
                                boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                            },
                        },
                        '& .MuiTabs-indicator': { display: 'none' },
                    }}
                >
                    <Tab value="calculations" label="Расчёты" />
                    <Tab value="import" label="Импорт / экспорт" />
                </Tabs>
            </Box>

            {/* Tab: Расчёты */}
            {activeTab === 'calculations' && (
                <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid #e8eaed', overflow: 'hidden' }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', p: 2, borderBottom: '1px solid #e8eaed' }}>
                        <Typography sx={{ fontSize: '14px', fontWeight: 600 }}>
                            Сохранённые расчёты
                        </Typography>
                        <Button size="small" onClick={loadCalculations} sx={{ textTransform: 'none', fontSize: '12px' }}>
                            Обновить
                        </Button>
                    </Box>
                    {loading ? (
                        <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                            <CircularProgress size={28} />
                        </Box>
                    ) : calculations.length === 0 ? (
                        <Typography sx={{ p: 3, fontSize: '13px', color: '#9aa0a6' }}>
                            Нет сохранённых расчётов. Сохраните расчёт на странице калькулятора.
                        </Typography>
                    ) : (
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow sx={{ backgroundColor: '#f8f9fa' }}>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Название</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Клиент</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Менеджер</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Статус</TableCell>
                                        <TableCell sx={{ fontSize: '12px', fontWeight: 600 }}>Создан</TableCell>
                                        <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 600 }} />
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {calculations.map((c) => (
                                        <TableRow key={c.id} hover>
                                            <TableCell sx={{ fontSize: '13px' }}>{c.name}</TableCell>
                                            <TableCell sx={{ fontSize: '13px' }}>{c.clientName}</TableCell>
                                            <TableCell sx={{ fontSize: '13px' }}>{c.managerName}</TableCell>
                                            <TableCell>
                                                <Chip
                                                    label={STATUS_LABELS[c.status] || c.status}
                                                    color={STATUS_COLORS[c.status] || 'default'}
                                                    size="small"
                                                    sx={{ fontSize: '11px', height: '22px' }}
                                                />
                                            </TableCell>
                                            <TableCell sx={{ fontSize: '12px', color: '#5f6368' }}>
                                                {new Date(c.createdAt).toLocaleString('ru-RU')}
                                            </TableCell>
                                            <TableCell align="right">
                                                <Button
                                                    size="small"
                                                    color="error"
                                                    onClick={() => handleDeleteCalculation(c.id)}
                                                    sx={{ textTransform: 'none', fontSize: '11px' }}
                                                >
                                                    Удалить
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    )}
                </Paper>
            )}

            {/* Tab: Импорт / экспорт */}
            {activeTab === 'import' && (
                <Paper elevation={0} sx={{ p: 3, borderRadius: '12px', border: '1px solid #e8eaed' }}>
                    <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                        Импорт справочников (JSON)
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, mb: 3, maxWidth: 480 }}>
                        {/* Конструкции */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                            <input
                                ref={constructsInputRef}
                                type="file"
                                accept=".json,application/json"
                                style={{ display: 'none' }}
                                onChange={(e) => handleImportFile(e.target.files?.[0], 'import-constructs', 'Конструкции')}
                            />
                            <Chip
                                label="Конструкции"
                                onClick={() => constructsInputRef.current?.click()}
                                sx={{
                                    fontSize: '12px',
                                    height: '32px',
                                    border: '1px solid #e37400',
                                    color: '#e37400',
                                    backgroundColor: '#fff8e1',
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#ffecb3' },
                                }}
                            />
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={handleExportConstructs}
                                sx={{
                                    fontSize: '12px',
                                    textTransform: 'none',
                                    borderColor: '#137333',
                                    color: '#137333',
                                    borderRadius: '20px',
                                    '&:hover': { backgroundColor: '#e8f5e9', borderColor: '#137333' },
                                }}
                            >
                                Экспорт
                            </Button>
                        </Box>
                        {/* Прайс коробок */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                            <input
                                ref={priceInputRef}
                                type="file"
                                accept=".json,application/json"
                                style={{ display: 'none' }}
                                onChange={(e) => handleImportFile(e.target.files?.[0], 'import-price-lists', 'Прайс коробок')}
                            />
                            <Chip
                                label="Прайс коробок"
                                onClick={() => priceInputRef.current?.click()}
                                sx={{
                                    fontSize: '12px',
                                    height: '32px',
                                    border: '1px solid #e37400',
                                    color: '#e37400',
                                    backgroundColor: '#fff8e1',
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#ffecb3' },
                                }}
                            />
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={handleExportPriceLists}
                                sx={{
                                    fontSize: '12px',
                                    textTransform: 'none',
                                    borderColor: '#137333',
                                    color: '#137333',
                                    borderRadius: '20px',
                                    '&:hover': { backgroundColor: '#e8f5e9', borderColor: '#137333' },
                                }}
                            >
                                Экспорт
                            </Button>
                        </Box>
                        {/* Прайс печати */}
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
                            <input
                                ref={printInputRef}
                                type="file"
                                accept=".json,application/json"
                                style={{ display: 'none' }}
                                onChange={(e) => handleImportFile(e.target.files?.[0], 'import-print-tables', 'Прайс печати')}
                            />
                            <Chip
                                label="Прайс печати"
                                onClick={() => printInputRef.current?.click()}
                                sx={{
                                    fontSize: '12px',
                                    height: '32px',
                                    border: '1px solid #e37400',
                                    color: '#e37400',
                                    backgroundColor: '#fff8e1',
                                    cursor: 'pointer',
                                    '&:hover': { backgroundColor: '#ffecb3' },
                                }}
                            />
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={handleExportPrintTables}
                                sx={{
                                    fontSize: '12px',
                                    textTransform: 'none',
                                    borderColor: '#137333',
                                    color: '#137333',
                                    borderRadius: '20px',
                                    '&:hover': { backgroundColor: '#e8f5e9', borderColor: '#137333' },
                                }}
                            >
                                Экспорт
                            </Button>
                        </Box>
                    </Box>

                    <Typography sx={{ fontSize: '14px', fontWeight: 600, mb: 2 }}>
                        Экспорт расчётов (JSON)
                    </Typography>
                    <Button
                        variant="outlined"
                        onClick={handleExportCalculations}
                        sx={{
                            fontSize: '12px',
                            textTransform: 'none',
                            borderColor: '#137333',
                            color: '#137333',
                            borderRadius: '8px',
                            '&:hover': { backgroundColor: '#e8f5e9', borderColor: '#137333' },
                        }}
                    >
                        Экспортировать все расчёты
                    </Button>
                </Paper>
            )}
        </Box>
    );
};
