// frontend/src/components/References/ConstructionsTab.tsx
import { useState, useCallback } from 'react';
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

    useState(() => {
        loadConstructs();
    });

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
            setConstructs((prev) => prev.filter((c) => c.id !== selectedConstruct));
            setSelectedConstruct(constructs.length > 1 ? constructs[0].id : '');
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

    // Экспорт JSON
    const handleExport = () => {
        if (!selectedConstructData) {
            onNotify('Выберите конструкцию для экспорта', 'error');
            return;
        }
        const json = JSON.stringify(selectedConstructData, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedConstructData.name}_конструкция.json`;
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
                if (!data.id || !data.name || !data.parts || !Array.isArray(data.parts.parts)) {
                    throw new Error('Неверный формат: отсутствует обязательные поля');
                }

                // Сохраняем через API
                calculatorApi.saveConstruct(data)
                    .then((saved) => {
                        loadConstructs();
                        setSelectedConstruct(saved.id);
                        onNotify('Импорт выполнен', 'success');
                    })
                    .catch((err) => {
                        onNotify('Ошибка импорта: ' + err.message, 'error');
                    });
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
                        disabled={!selectedConstruct}
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
                    <Typography sx={{ fontSize: '14px', fontWeight: 500 }}>
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
                                    <TableCell align="center" sx={{ fontSize: '11px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase', width: 80 }}>
                                        руб./лист
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
                                                inputProps={{ step: 0.001, min: 0, style: { textAlign: 'center', fontSize: '12px', width: 50 } }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: '6px',
                                                        backgroundColor: part.perSheet === 0 ? '#f8f9fa' : '#fff',
                                                    },
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <TextField
                                                type="number"
                                                value={35}
                                                onChange={(e) => handlePartChange(part.name, 'perSheet', parseFloat(e.target.value) || 0)}
                                                size="small"
                                                inputProps={{ step: 1, min: 0, style: { textAlign: 'center', fontSize: '12px', width: 50 } }}
                                                sx={{
                                                    '& .MuiOutlinedInput-root': {
                                                        borderRadius: '6px',
                                                        backgroundColor: '#fff',
                                                    },
                                                }}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <Button
                                                size="small"
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
                        onClick={handleAddPart}
                        disabled={!selectedConstructData}
                        sx={{
                            backgroundColor: '#1a73e8',
                            color: '#fff',
                            borderRadius: '24px',
                            fontSize: '13px',
                            '&:hover': { backgroundColor: '#1557b0' },
                        }}
                    >
                        Добавить деталь
                    </Button>
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
                        disabled={!selectedConstructData}
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
