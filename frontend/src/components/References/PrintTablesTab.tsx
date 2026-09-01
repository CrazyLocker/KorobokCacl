// frontend/src/components/References/PrintTablesTab.tsx
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
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
} from '@mui/material';
import type { PrintTable } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';

interface Props {
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
}

export const PrintTablesTab = ({ onNotify }: Props) => {
    const [printTables, setPrintTables] = useState<PrintTable[]>([]);
    const [selectedFormat, setSelectedFormat] = useState<number | ''>('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Диалог подтверждения удаления
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);

    // Загрузка таблиц печати
    useEffect(() => {
        setLoading(true);
        calculatorApi.getPrintTables()
            .then((data) => {
                setPrintTables(data);
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
            await calculatorApi.savePrintTable(selectedTable);
            onNotify('Таблица печати сохранена', 'success');
        } catch (err: any) {
            onNotify('Ошибка сохранения: ' + (err.response?.data?.message || err.message), 'error');
        } finally {
            setSaving(false);
        }
    };

    // Открыть диалог удаления
    const handleDeleteClick = () => {
        if (!selectedTable) return;
        setDeleteTarget({ id: selectedTable.id, name: selectedTable.formatName });
        setDeleteDialogOpen(true);
    };

    // Подтвердить удаление
    const handleDeleteConfirm = async () => {
        if (!deleteTarget) return;
        try {
            await calculatorApi.deletePrintTable(deleteTarget.id);
            setPrintTables((prev) => prev.filter((t) => t.id !== deleteTarget.id));
            setSelectedFormat(printTables.length > 1 ? printTables[0].formatId : '');
            onNotify('Формат удалён', 'success');
        } catch (err: any) {
            onNotify('Ошибка удаления: ' + (err.response?.data?.message || err.message), 'error');
        }
        setDeleteDialogOpen(false);
        setDeleteTarget(null);
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
            steps: [...selectedTable.steps, { minQty: newQty, price: newPrice }],
        };

        setPrintTables((prev) => prev.map((t) => (t.formatId === updated.formatId ? updated : t)));
        onNotify('Шаг добавлен', 'success');
    };

    // Обновить шаг
    const handleStepChange = (index: number, field: 'minQty' | 'price', value: number) => {
        if (!selectedTable) return;

        const updatedSteps = selectedTable.steps.map((step, i) =>
            i === index ? { ...step, [field]: value } : step
        );

        const updated = { ...selectedTable, steps: updatedSteps };
        setPrintTables((prev) => prev.map((t) => (t.formatId === updated.formatId ? updated : t)));
    };

    // Удалить шаг
    const handleDeleteStep = (index: number) => {
        if (!selectedTable) return;

        const updatedSteps = selectedTable.steps.filter((_, i) => i !== index);
        const updated = { ...selectedTable, steps: updatedSteps };
        setPrintTables((prev) => prev.map((t) => (t.formatId === updated.formatId ? updated : t)));
        onNotify('Шаг удалён', 'success');
    };

    // Обновить шаг после 3000
    const handleStepAfter3000Change = (value: number) => {
        if (!selectedTable) return;
        const updated = { ...selectedTable, stepAfter3000: value };
        setPrintTables((prev) => prev.map((t) => (t.formatId === updated.formatId ? updated : t)));
    };

    // Экспорт JSON
    const handleExport = () => {
        if (!selectedTable) {
            onNotify('Выберите формат для экспорта', 'error');
            return;
        }
        const json = JSON.stringify(selectedTable, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${selectedTable.formatName}_печать.json`;
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
                if (!data.id || !data.formatId || !data.formatName || !Array.isArray(data.steps)) {
                    throw new Error('Неверный формат: отсутствуют обязательные поля');
                }

                calculatorApi.savePrintTable(data as PrintTable)
                    .then((saved) => {
                        setPrintTables((prev) => {
                            const filtered = prev.filter((t) => t.id !== saved.id);
                            return [...filtered, saved];
                        });
                        setSelectedFormat(saved.formatId);
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
                    Формат печати
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Select
                        value={selectedFormat}
                        onChange={(e) => setSelectedFormat(e.target.value as number)}
                        sx={{ minWidth: 200, '& .MuiSelect-select': { fontSize: '14px' } }}
                    >
                        {printTables.map((t) => (
                            <MenuItem key={t.formatId} value={t.formatId}>{t.formatName}</MenuItem>
                        ))}
                    </Select>
                    <TextField
                        value={selectedTable?.formatName || ''}
                        onChange={(e) => {
                            if (!selectedTable) return;
                            const updated = { ...selectedTable, formatName: e.target.value };
                            setPrintTables((prev) => prev.map((t) => (t.formatId === t.formatId ? updated : t)));
                        }}
                        label="Название"
                        size="small"
                        sx={{ minWidth: 200 }}
                    />
                    <TextField
                        value={selectedTable?.stepAfter3000 || 0}
                        onChange={(e) => handleStepAfter3000Change(parseFloat(e.target.value) || 0)}
                        label="Шаг после 3000"
                        size="small"
                        type="number"
                        inputProps={{ step: 1, min: 0 }}
                        sx={{ minWidth: 100 }}
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
                        onClick={handleDeleteClick}
                        disabled={!selectedTable}
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

            {/* Таблица шагов */}
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
                        Стоимость печати по форматам
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
                        {selectedTable?.steps.length || 0} шагов
                    </Typography>
                </Box>

                {loading ? (
                    <Box sx={{ p: 4, textAlign: 'center' }}>
                        <CircularProgress />
                    </Box>
                ) : !selectedTable ? (
                    <Box sx={{ p: 4, textAlign: 'center', color: '#9aa0a6' }}>
                        Выберите формат
                    </Box>
                ) : (
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell align="center" sx={{ fontSize: '11px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase', width: 120 }}>
                                        Мин. тираж
                                    </TableCell>
                                    <TableCell align="center" sx={{ fontSize: '11px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase', width: 120 }}>
                                        Цена (₽)
                                    </TableCell>
                                    <TableCell sx={{ width: 40 }} />
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {selectedTable.steps.map((step, index) => (
                                    <TableRow key={index}>
                                        <TableCell align="center">
                                            <TextField
                                                type="number"
                                                value={step.minQty}
                                                onChange={(e) => handleStepChange(index, 'minQty', parseFloat(e.target.value) || 0)}
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
                                            <TextField
                                                type="number"
                                                value={step.price}
                                                onChange={(e) => handleStepChange(index, 'price', parseFloat(e.target.value) || 0)}
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
                                                onClick={() => handleDeleteStep(index)}
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
                        onClick={handleAddStep}
                        disabled={!selectedTable}
                        sx={{
                            backgroundColor: '#1a73e8',
                            color: '#fff',
                            borderRadius: '24px',
                            fontSize: '13px',
                            '&:hover': { backgroundColor: '#1557b0' },
                        }}
                    >
                        Добавить шаг
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
                        disabled={!selectedTable}
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

            {/* Диалог подтверждения удаления */}
            <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
                <DialogTitle>Удаление формата</DialogTitle>
                <DialogContent>
                    <Typography>Удалить формат "{deleteTarget?.name}"?</Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>Отмена</Button>
                    <Button onClick={handleDeleteConfirm} variant="contained" sx={{ backgroundColor: '#d93025', '&:hover': { backgroundColor: '#b71c1c' } }}>
                        Удалить
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};
