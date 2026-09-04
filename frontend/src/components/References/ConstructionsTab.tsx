// frontend/src/components/References/ConstructionsTab.tsx
import { useState, useCallback, useEffect } from 'react';
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
import type { Construct } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';
import { selectSx, menuItemSx, numberInputSx, numberInputProps } from '../../styles/uiStyles';

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

export const ConstructionsTab = ({ onNotify }: Props) => {
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
    const handleDelete = async () => {
        if (!selectedConstruct) return;
        if (!confirm(`Удалить конструкцию "${selectedConstructData?.name}"?`)) return;

        try {
            await calculatorApi.deleteConstruct(selectedConstruct);
            const remaining = constructs.filter((c) => c.id !== selectedConstruct);
            setConstructs(remaining);
            setSelectedConstruct(remaining.length > 0 ? remaining[0].id : '');
            onNotify('Конструкция удалена', 'success');
        } catch (err: any) {
            onNotify('Ошибка удаления: ' + (err.response?.data?.message || err.message), 'error');
        }
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
                <Typography sx={{ fontSize: '12px', color: '#5f6368', mb: 1, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Конструкция
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Select
                        value={selectedConstruct || ''}
                        onChange={(e) => setSelectedConstruct(e.target.value)}
                        sx={{ ...selectSx, minWidth: 200 }}
                    >
                        {constructs.map((c) => (
                            <MenuItem key={c.id} value={c.id} sx={menuItemSx}>{c.name}</MenuItem>
                        ))}
                    </Select>
                    <TextField
                        value={selectedConstructData?.name || ''}
                        onChange={(e) => {
                            if (!selectedConstructData) return;
                            const updated = { ...selectedConstructData, name: e.target.value };
                            setConstructs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
                        }}
                        label="Название"
                        size="small"
                        sx={{ minWidth: 200 }}
                    />
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={handleSave}
                        disabled={saving}
                        sx={{
                            borderColor: '#137333',
                            color: '#137333',
                            fontSize: '12px',
                            textTransform: 'none',
                            borderRadius: '20px',
                            '&:hover': { backgroundColor: '#e8f5e9', borderColor: '#137333' },
                        }}
                    >
                        {saving ? <CircularProgress size={16} color="inherit" /> : 'Сохранить'}
                    </Button>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={handleDelete}
                        disabled={!selectedConstruct}
                        sx={{
                            borderColor: '#d93025',
                            color: '#d93025',
                            fontSize: '12px',
                            textTransform: 'none',
                            borderRadius: '20px',
                            '&:hover': { backgroundColor: '#fce8e6', borderColor: '#d93025' },
                        }}
                    >
                        Удалить
                    </Button>
                </Box>
            </Paper>

            {/* Таблица деталей */}
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
                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#202124', pb: 1, borderBottom: '2px solid #1a73e8', flex: 1, textAlign: 'left' }}>
                        Параметры раскладки деталей
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
                        {selectedConstructData?.parts.parts.length || 0} деталей
                    </Typography>
                </Box>

                {loading ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <CircularProgress />
                    </Box>
                ) : !selectedConstructData ? (
                    <Box sx={{ p: 4, textAlign: 'center', color: '#9aa0a6' }}>
                        Выберите конструкцию
                    </Box>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell sx={{ fontSize: '11px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase' }}>
                                        Деталь
                                    </TableCell>
                                    <TableCell align="center" sx={{ fontSize: '11px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase', width: 80 }}>
                                        шт./лист
                                    </TableCell>
                                    <TableCell sx={{ width: 40 }} />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {selectedConstructData.parts.parts.map((part) => (
                                    <TableRow key={part.name}>
                                        <TableCell>
                                            <Typography sx={{ fontSize: '13px', fontWeight: 500 }}>
                                                {part.name}
                                            </Typography>
                                        </TableCell>
                                        <TableCell align="center">
                                            <TextField
                                                type="number"
                                                value={part.perSheet}
                                                onChange={(e) => handlePartChange(part.name, 'perSheet', parseFloat(e.target.value) || 0)}
                                                size="small"
                                                inputProps={{ ...numberInputProps(0.001), style: { ...numberInputProps().style, width: 50 } }}
                                                sx={{
                                                    ...numberInputSx,
                                                    '& .MuiOutlinedInput-root': {
                                                        ...((numberInputSx as any)['& .MuiOutlinedInput-root'] || {}),
                                                        backgroundColor: part.perSheet === 0 ? '#f8f9fa' : '#fff',
                                                    },
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Button
                                                size="small"
                                                onClick={() => handleRemovePart(part.name)}
                                                sx={{ color: '#d93025', opacity: 0.5, '&:hover': { opacity: 1 } }}
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

                {/* Действия */}
                <Box sx={{ p: 2, borderTop: '1px solid #e8eaed', display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Button
                        variant="outlined"
                        size="small"
                        onClick={handleAddPart}
                        disabled={!selectedConstructData}
                        sx={{
                            borderColor: '#1a73e8',
                            color: '#1a73e8',
                            fontSize: '12px',
                            textTransform: 'none',
                            borderRadius: '20px',
                            '&:hover': { backgroundColor: '#e8f0fe', borderColor: '#1a73e8' },
                        }}
                    >
                        Добавить деталь
                    </Button>
                </Box>
            </Paper>
        </Box>
    );
};
