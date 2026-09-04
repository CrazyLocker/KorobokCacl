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
import { selectSx, menuItemSx, numberInputSx, numberInputProps } from '../../styles/uiStyles';

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
                    Формат печати
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
                    <Select
                        value={selectedFormat}
                        onChange={(e) => setSelectedFormat(e.target.value as number)}
                        sx={{ ...selectSx, minWidth: 200 }}
                    >
                        {printTables.map((t) => (
                            <MenuItem key={t.formatId} value={t.formatId} sx={menuItemSx}>{t.formatName}</MenuItem>
                        ))}
                    </Select>
                    <TextField
                        value={selectedTable?.formatName || ''}
                        onChange={(e) => {
                            if (!selectedTable) return;
                            const updated = { ...selectedTable, formatName: e.target.value };
                            setPrintTables((prev) => prev.map((t) => (t.formatId === updated.formatId ? updated : t)));
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
                        onClick={handleDeleteClick}
                        disabled={!selectedTable}
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
                    <Typography sx={{ fontSize: '14px', fontWeight: 600, color: '#202124', pb: 1, borderBottom: '2px solid #1a73e8', flex: 1, textAlign: 'left' }}>
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
                                                inputProps={{ ...numberInputProps(1), style: { ...numberInputProps().style, width: 50 } }}
                                                sx={numberInputSx}
                                            />
                                        </TableCell>
                                        <TableCell align="center">
                                            <TextField
                                                type="number"
                                                value={step.price}
                                                onChange={(e) => handleStepChange(index, 'price', parseFloat(e.target.value) || 0)}
                                                size="small"
                                                inputProps={{ ...numberInputProps(1), style: { ...numberInputProps().style, width: 50 } }}
                                                sx={numberInputSx}
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
                        variant="outlined"
                        size="small"
                        onClick={handleAddStep}
                        disabled={!selectedTable}
                        sx={{
                            borderColor: '#1a73e8',
                            color: '#1a73e8',
                            fontSize: '12px',
                            textTransform: 'none',
                            borderRadius: '20px',
                            '&:hover': { backgroundColor: '#e8f0fe', borderColor: '#1a73e8' },
                        }}
                    >
                        Добавить шаг
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
