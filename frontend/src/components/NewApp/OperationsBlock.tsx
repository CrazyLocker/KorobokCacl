// frontend/src/components/NewApp/OperationsBlock.tsx
import { Box, Typography, TextField, Button, Select, MenuItem, FormControl, InputLabel } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { Extra, PrintSettings, PrintTable } from '../../types';

interface Props {
    extras: Extra[];
    printSettings: PrintSettings;
    printTables: PrintTable[];
    onUpdateExtra: (index: number, field: keyof Extra, value: any) => void;
    onAddCustomExtra: () => void;
    onUpdatePrintSettings: (field: keyof PrintSettings, value: any) => void;
}

export const OperationsBlock = ({
    extras,
    printSettings,
    printTables,
    onUpdateExtra,
    onAddCustomExtra,
    onUpdatePrintSettings,
}: Props) => {
    return (
        <Box
            sx={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid #e8eaed',
                p: 2,
                mb: 2,
            }}
        >
            <Typography
                sx={{
                    fontSize: '16px',
                    fontWeight: 600,
                    color: '#202124',
                    mb: 2,
                    pb: 1,
                    borderBottom: '2px solid #1a73e8',
                }}
            >
                Дополнительные операции
            </Typography>

            {/* Standard extras */}
            {extras.map((extra, index) => (
                <Box
                    key={extra.name}
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        py: 0.75,
                        borderBottom: index < extras.length - 1 ? '1px solid #f1f3f4' : 'none',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flex: 1 }}>
                        <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#202124' }}>
                            {extra.name}
                        </Typography>
                        {extra.name === 'Стоимость печати' ? (
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography sx={{ fontSize: '12px', color: '#5f6368' }}>
                                    {extra.cost} руб.
                                </Typography>
                                <FormControl size="small" sx={{ minWidth: 100 }}>
                                    <InputLabel sx={{ fontSize: '11px' }}>Формат</InputLabel>
                                    <Select
                                        value={printSettings.format}
                                        label="Формат"
                                        onChange={(e) => onUpdatePrintSettings('format', e.target.value)}
                                        sx={{ fontSize: '11px' }}
                                    >
                                        {printTables.map((t) => (
                                            <MenuItem key={t.formatId} value={t.formatId}>
                                                {t.formatName}
                                            </MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                                <FormControl size="small" sx={{ minWidth: 70 }}>
                                    <InputLabel sx={{ fontSize: '11px' }}>Тираж</InputLabel>
                                    <Select
                                        value={printSettings.quantity}
                                        label="Тираж"
                                        onChange={(e) => onUpdatePrintSettings('quantity', e.target.value)}
                                        sx={{ fontSize: '11px' }}
                                    >
                                        {[100, 300, 500, 1000, 1500, 2000, 3000].map((q) => (
                                            <MenuItem key={q} value={q}>{q}</MenuItem>
                                        ))}
                                    </Select>
                                </FormControl>
                            </Box>
                        ) : (
                            <>
                                <TextField
                                    type="number"
                                    value={extra.cost}
                                    onChange={(e) => onUpdateExtra(index, 'cost', parseFloat(e.target.value) || 0)}
                                    size="small"
                                    inputProps={{ step: 1, min: 0, style: { fontSize: '12px', width: 50, textAlign: 'center' } }}
                                    sx={{
                                        '& .MuiOutlinedInput-root': {
                                            borderRadius: '8px',
                                            backgroundColor: '#fff',
                                        },
                                    }}
                                />
                                <Typography sx={{ fontSize: '12px', color: '#5f6368' }}>
                                    Руб.
                                </Typography>
                            </>
                        )}
                    </Box>
                </Box>
            ))}

            {/* Add operation button */}
            <Button
                startIcon={<AddIcon />}
                onClick={onAddCustomExtra}
                sx={{
                    mt: 1.5,
                    fontSize: '13px',
                    textTransform: 'none',
                    color: '#1a73e8',
                    border: '1px dashed #1a73e8',
                    borderRadius: '8px',
                    px: 2,
                    py: 0.5,
                    '&:hover': { backgroundColor: '#e8f0fe' },
                }}
            >
                + Добавить операцию
            </Button>
        </Box>
    );
};
