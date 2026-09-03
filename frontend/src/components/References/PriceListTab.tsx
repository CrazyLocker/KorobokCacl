// frontend/src/components/References/PriceListTab.tsx
import { useState, useEffect } from 'react';
import {
    Box,
    Typography,
    Select,
    MenuItem,
    TextField,
    Button,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Paper,
    CircularProgress,
    Alert,
} from '@mui/material';
import type { Construct, PriceListData } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';

const PRICE_RANGES = ['до 9', '10–49', '50–199', '200–499', '500–699', '700–1499', 'от 1500'];

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

export const PriceListTab = ({ onNotify }: Props) => {
    const [constructs, setConstructs] = useState<Construct[]>([]);
    const [selectedConstruct, setSelectedConstruct] = useState<string>('');
    const [priceCode, setPriceCode] = useState<string>('');
    const [priceData, setPriceData] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Загрузка конструкций
    useEffect(() => {
        setLoading(true);
        calculatorApi.getConstructs()
            .then((data) => {
                setConstructs(data);
                if (data.length > 0) {
                    setSelectedConstruct(data[0].id);
                }
            })
            .catch((err) => {
                setError('Ошибка загрузки: ' + err.message);
            })
            .finally(() => setLoading(false));
    }, []);

    const selectedConstructData = constructs.find((c) => c.id === selectedConstruct);

    // Загрузка прайс-листа
    useEffect(() => {
        if (!selectedConstruct) return;
        calculatorApi.getPriceList(selectedConstruct)
            .then((data) => {
                if (data) {
                    setPriceData(data.priceData || {});
                    setPriceCode(data.id);
                } else {
                    setPriceData({});
                    setPriceCode('');
                }
            })
            .catch(() => {
                setPriceData({});
                setPriceCode('');
            });
    }, [selectedConstruct]);

    // Сохранение прайс-листа
    const handleSave = async () => {
        if (!selectedConstruct) {
            onNotify('Выберите конструкцию', 'error');
            return;
        }
        setSaving(true);
        try {
            const priceListData: PriceListData = {
                id: priceCode || null,
                constructId: selectedConstruct,
                priceData,
            };
            const saved = await calculatorApi.savePriceList(priceListData);
            setPriceCode(saved.id);
            onNotify('Прайс-лист сохранён', 'success');
        } catch (err: any) {
            onNotify('Ошибка сохранения: ' + (err.response?.data?.message || err.message), 'error');
        } finally {
            setSaving(false);
        }
    };

    // Удаление прайс-листа
    const handleDelete = async () => {
        if (!selectedConstruct || !priceCode) {
            onNotify('Прайс-лист не найден', 'error');
            return;
        }
        if (!confirm(`Удалить прайс-лист для "${selectedConstructData?.name}"?`)) return;

        try {
            await calculatorApi.deletePriceList(priceCode);
            setPriceData({});
            setPriceCode('');
            onNotify('Прайс-лист удалён', 'success');
        } catch (err: any) {
            onNotify('Ошибка удаления: ' + (err.response?.data?.message || err.message), 'error');
        }
    };

    // Обновление цены
    const handlePriceChange = (range: string, value: number) => {
        setPriceData((prev) => ({ ...prev, [range]: value }));
    };

    // Экспорт JSON
    const handleExport = () => {
        if (!selectedConstruct) {
            onNotify('Выберите конструкцию для экспорта', 'error');
            return;
        }
        const exportData = {
            name: selectedConstructData?.name || '',
            code: priceCode,
            prices: priceData,
        };
        const json = JSON.stringify(exportData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${exportData.name}_прайс.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        onNotify('Экспорт выполнен', 'success');
    };

    // Импорт JSON
    const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target?.result as string);

                // Валидация
                if (!data.prices || typeof data.prices !== 'object') {
                    throw new Error('Неверный формат: отсутствует prices');
                }

                setPriceData(data.prices);
                if (data.code) setPriceCode(data.code);
                onNotify('Импорт выполнен', 'success');
            } catch (err: any) {
                onNotify('Ошибка импорта: ' + err.message, 'error');
            }
        };
        reader.readAsText(file);
        event.target.value = '';
    };

    return (
        <Box>
            {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

            {/* Конструктор */}
            <Paper
                elevation={0}
                sx={{
                    p: 2,
                    mb: 2,
                    borderRadius: '12px',
                    border: '1px solid #e8eaed',
                    backgroundColor: '#f8f9fa',
                }}
            >
                <Typography sx={{ fontSize: '12px', color: '#5f6368', mb: 1, textTransform: 'uppercase' }}>
                    Конструкция
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Select
                        value={selectedConstruct || ''}
                        onChange={(e) => setSelectedConstruct(e.target.value)}
                        sx={{ minWidth: 200, '& .MuiSelect-select': { fontSize: '14px' } }}
                    >
                        {constructs.map((c) => (
                            <MenuItem key={c.id} value={c.id}>{c.name}</MenuItem>
                        ))}
                    </Select>
                    <TextField
                        value={priceCode}
                        onChange={(e) => setPriceCode(e.target.value)}
                        label="Код"
                        size="small"
                        placeholder="UUID"
                        sx={{ minWidth: 120 }}
                    />
                    <Button
                        variant="contained"
                        onClick={handleSave}
                        disabled={saving}
                        sx={{
                            backgroundColor: '#137333',
                            borderRadius: '24px',
                            '&:hover': { backgroundColor: '#0d5a28' },
                        }}
                    >
                        {saving ? <CircularProgress size={20} color="inherit" /> : 'Сохранить'}
                    </Button>
                    <Button
                        variant="contained"
                        onClick={handleDelete}
                        disabled={!priceCode}
                        sx={{
                            backgroundColor: '#d93025',
                            borderRadius: '24px',
                            '&:hover': { backgroundColor: '#b71c1c' },
                        }}
                    >
                        Удалить
                    </Button>
                </Box>
            </Paper>

            {/* Таблица прайса */}
            <Paper elevation={0} sx={{ borderRadius: '12px', border: '1px solid #e8eaed', overflow: 'hidden' }}>
                <Box
                    sx={{
                        p: 2,
                        pb: 1,
                        borderBottom: '1px solid #e8eaed',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                    }}
                >
                    <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
                        Прайс-лист коробок
                    </Typography>
                    <Typography
                        sx={{
                            fontSize: '10px',
                            fontWeight: 500,
                            backgroundColor: '#1a73e8',
                            color: '#fff',
                            px: 2,
                            py: 0.25,
                            borderRadius: '16px',
                        }}
                    >
                        {Object.keys(priceData).length} позиций
                    </Typography>
                </Box>

                {loading ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <CircularProgress />
                    </Box>
                ) : !selectedConstruct ? (
                    <Box sx={{ p: 4, textAlign: 'center', color: '#9aa0a6' }}>
                        Выберите конструкцию
                    </Box>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontSize: '11px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase' }}>
                                        Диапазон
                                    </TableCell>
                                    <TableCell align="center" sx={{ fontSize: '11px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase', width: 120 }}>
                                        Цена (₽)
                                    </TableCell>
                                    <TableCell sx={{ width: 40 }} />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {PRICE_RANGES.map((range) => (
                                    <TableRow key={range}>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                                {range}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <TextField
                                                type="number"
                                                value={priceData[range] || 0}
                                                onChange={(e) => handlePriceChange(range, parseFloat(e.target.value) || 0)}
                                                size="small"
                                                inputProps={{ step: 1, min: 0, style: { textAlign: 'center', fontSize: '12px', width: 50 } }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: '6px',
                                                        backgroundColor: (priceData[range] || 0) === 0 ? '#f8f9fa' : '#fff',
                                                    },
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell />
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </TableContainer>
                )}

                {/* Действия */}
                <Box sx={{ p: 2, borderTop: '1px solid #e8eaed', display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Box sx={{ position: 'relative' }}>
                        <Button
                            variant="outlined"
                            sx={{
                                borderColor: '#e37400',
                                color: '#e37400',
                                borderRadius: '20px',
                                fontSize: '12px',
                                '&:hover': { backgroundColor: '#fff3e0' },
                            }}
                        >
                            Импорт JSON
                        </Button>
                        <input
                            type="file"
                            accept=".json"
                            onChange={handleImport}
                            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                        />
                    </Box>
                    <Button
                        onClick={handleExport}
                        disabled={!selectedConstruct}
                        variant="outlined"
                        sx={{
                            borderColor: '#137333',
                            color: '#137333',
                            borderRadius: '24px',
                            fontSize: '12px',
                            '&:hover': { backgroundColor: '#e8f5e9' },
                        }}
                    >
                        Экспорт JSON
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};
