// frontend/src/components/Calculator/ExtrasBlock.tsx
import {
    Box,
    Typography,
    Select,
    MenuItem,
    TextField,
    Button,
} from '@mui/material';
import type { Extra, PrintSettings, PrintTable } from '../../types';
import { selectSx, menuItemSx, numberInputSx, numberInputProps } from '../../styles/uiStyles';

interface Props {
    extras: Extra[];
    printSettings: PrintSettings;
    printTables: PrintTable[];
    onUpdateExtra: (index: number, field: keyof Extra, value: any) => void;
    onAddCustomExtra: () => void;
    onRemoveCustomExtra: (index: number) => void;
    onUpdatePrintSettings: (field: keyof PrintSettings, value: any) => void;
}

export const ExtrasBlock = ({
    extras,
    printSettings,
    printTables,
    onUpdateExtra,
    onAddCustomExtra,
    onRemoveCustomExtra,
    onUpdatePrintSettings,
}: Props) => {
    const currentTable = printTables.find((t) => t.formatId === printSettings.format);
    const qtyOptions = currentTable?.steps?.map((s) => s.minQty) || [100, 300, 500, 1000, 1500, 2000, 3000];

    // Calculate print cost per unit for display
    let printPerUnit = 0;
    if (printSettings.enabled && currentTable && printSettings.quantity > 0) {
        const step = currentTable.steps.find((s) => s.minQty >= printSettings.quantity);
        let cost = step?.price || currentTable.steps[0]?.price || 0;
        if (printSettings.quantity >= 3000) {
            const lastStep = currentTable.steps[currentTable.steps.length - 1];
            const extra = Math.ceil((printSettings.quantity - 3000) / 1000) * currentTable.stepAfter3000;
            cost = lastStep.price + extra;
        }
        printPerUnit = cost / printSettings.quantity;
    }

    return (
        <Box>
            {/* Print settings */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '4px 0',
                    borderBottom: '2px solid #1a73e8',
                    paddingBottom: '8px',
                    marginBottom: '4px',
                    flexWrap: 'wrap',
                    gap: 1,
                }}
            >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                    <Typography sx={{ fontWeight: 500, fontSize: '12px' }}>Печать</Typography>
                    <Select
                        size="small"
                        value={printSettings.format}
                        onChange={(e) => {
                            const fmt = e.target.value as number;
                            const table = printTables.find((t) => t.formatId === fmt);
                            const firstQty = table?.steps?.[0]?.minQty || 100;
                            onUpdatePrintSettings('format', fmt);
                            onUpdatePrintSettings('quantity', firstQty);
                            onUpdatePrintSettings('enabled', true);
                        }}
                        sx={{ ...selectSx, minWidth: 180 }}
                    >
                        {printTables.map((t) => (
                            <MenuItem key={t.formatId} value={t.formatId} sx={menuItemSx}>
                                {t.formatName}
                            </MenuItem>
                        ))}
                    </Select>
                    <Select
                        size="small"
                        value={printSettings.quantity}
                        onChange={(e) => {
                            onUpdatePrintSettings('quantity', e.target.value as number);
                            onUpdatePrintSettings('enabled', true);
                        }}
                        sx={{ ...selectSx, minWidth: 80 }}
                    >
                        {qtyOptions.map((q) => (
                            <MenuItem key={q} value={q} sx={menuItemSx}>
                                {q}
                            </MenuItem>
                        ))}
                    </Select>
                    <Typography sx={{ fontSize: '11px', color: '#9aa0a6' }}>
                        → {printPerUnit.toFixed(2)} руб./ед.
                    </Typography>
                </Box>
                <Typography
                    sx={{
                        fontSize: '12px',
                        fontWeight: 500,
                        color: '#1a73e8',
                        backgroundColor: '#e8f0fe',
                        padding: '2px 12px',
                        borderRadius: '20px',
                    }}
                >
                    {printPerUnit.toFixed(2)} <span style={{ fontSize: '11px', fontWeight: 400 }}>руб.</span>
                </Typography>
            </Box>

            {/* All extras (standard + custom) in a unified list */}
            {extras.map((extra, index) => (
                <Box
                    key={index}
                    sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '4px 0',
                        borderBottom: '1px solid #e8eaed',
                    }}
                >
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {extra.isCustom ? (
                            <TextField
                                value={extra.name}
                                onChange={(e) => onUpdateExtra(index, 'name', e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') (e.target as HTMLElement).blur();
                                }}
                                size="small"
                                disabled={false}
                                placeholder="Название"
                                inputProps={{ style: { fontSize: '12px', width: 70 } }}
                            />
                        ) : (
                            <Typography sx={{ fontWeight: 500, fontSize: '12px' }}>{extra.name}</Typography>
                        )}
                        <TextField
                            type="number"
                            value={extra.cost}
                            onChange={(e) => onUpdateExtra(index, 'cost', parseFloat(e.target.value) || 0)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLElement).blur();
                            }}
                            size="small"
                            inputProps={{ ...numberInputProps(1), style: { ...numberInputProps().style, width: 40 } }}
                            sx={numberInputSx}
                        />
                        <Typography sx={{ fontSize: '11px', color: '#9aa0a6' }}>руб.</Typography>
                        {extra.isCustom && (
                            <Button
                                size="small"
                                onClick={() => onRemoveCustomExtra(index)}
                                sx={{ color: '#d93025', opacity: 0.5, '&:hover': { opacity: 1 } }}
                            >
                                Удалить
                            </Button>
                        )}
                    </Box>
                    <Typography
                        sx={{
                            fontSize: '13px',
                            fontWeight: 500,
                            backgroundColor: '#fff',
                            padding: '2px 12px',
                            borderRadius: '20px',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                        }}
                    >
                        {extra.cost.toFixed(2)} <span style={{ fontSize: '11px', fontWeight: 400, color: '#9aa0a6' }}>руб.</span>
                    </Typography>
                </Box>
            ))}

            {/* Add operation button */}
            <Button
                onClick={onAddCustomExtra}
                sx={{
                    mt: 1,
                    border: '1px dashed #1a73e8',
                    borderRadius: '8px',
                    color: '#1a73e8',
                    fontSize: '12px',
                    textTransform: 'none',
                    '&:hover': { backgroundColor: '#e8f0fe' },
                }}
            >
                Добавить операцию
            </Button>
        </Box>
    );
};
