// frontend/src/components/Calculator/SaveCalculationDialog.tsx
import { useState } from 'react';
import {
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    Button,
    TextField,
    Box,
} from '@mui/material';
import type { CalculationRequest } from '../../types';
import { calculatorApi } from '../../api/calculatorApi';

interface Props {
    open: boolean;
    onClose: () => void;
    onNotify: (message: string, severity?: 'success' | 'error' | 'info') => void;
    calculation: CalculationRequest;
}

/** Диалог сохранения расчёта: название, клиент и менеджер — обязательные поля. */
export const SaveCalculationDialog = ({ open, onClose, onNotify, calculation }: Props) => {
    const [name, setName] = useState('');
    const [clientName, setClientName] = useState('');
    const [managerName, setManagerName] = useState('');
    const [errors, setErrors] = useState<{ name?: string; clientName?: string; managerName?: string }>({});
    const [saving, setSaving] = useState(false);

    const handleSave = async () => {
        const nextErrors: typeof errors = {};
        if (!name.trim()) nextErrors.name = 'Укажите название расчёта';
        if (!clientName.trim()) nextErrors.clientName = 'Укажите клиента';
        if (!managerName.trim()) nextErrors.managerName = 'Укажите менеджера';
        setErrors(nextErrors);
        if (Object.keys(nextErrors).length > 0) return;

        setSaving(true);
        try {
            await calculatorApi.saveCalculation({
                name: name.trim(),
                clientName: clientName.trim(),
                managerName: managerName.trim(),
                calculation,
            });
            onNotify('Расчёт сохранён', 'success');
            setName('');
            setClientName('');
            setManagerName('');
            setErrors({});
            onClose();
        } catch (err: any) {
            onNotify('Ошибка сохранения: ' + (err.response?.data?.message || err.message), 'error');
        } finally {
            setSaving(false);
        }
    };

    const handleClose = () => {
        setErrors({});
        onClose();
    };

    return (
        <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
            <DialogTitle sx={{ fontSize: '16px', fontWeight: 600 }}>Сохранить расчёт</DialogTitle>
            <DialogContent>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 0.5 }}>
                    <TextField
                        label="Название расчёта"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        error={Boolean(errors.name)}
                        helperText={errors.name}
                        size="small"
                        autoFocus
                    />
                    <TextField
                        label="Клиент"
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        error={Boolean(errors.clientName)}
                        helperText={errors.clientName}
                        size="small"
                    />
                    <TextField
                        label="Менеджер"
                        value={managerName}
                        onChange={(e) => setManagerName(e.target.value)}
                        error={Boolean(errors.managerName)}
                        helperText={errors.managerName}
                        size="small"
                    />
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={handleClose} size="small" sx={{ textTransform: 'none' }}>
                    Отмена
                </Button>
                <Button onClick={handleSave} variant="contained" disabled={saving} size="small" sx={{ textTransform: 'none' }}>
                    Сохранить
                </Button>
            </DialogActions>
        </Dialog>
    );
};
