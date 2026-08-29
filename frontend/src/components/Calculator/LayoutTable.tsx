// frontend/src/components/Calculator/LayoutTable.tsx
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Checkbox,
    IconButton,
    Button,
    Box,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import CloseIcon from '@mui/icons-material/Close';
import type { Detail, Extra } from '../../types';

interface Props {
    details: Detail[];
    extras: Extra[];
    onUpdateDetail: (index: number, field: keyof Detail, value: any) => void;
    onUpdateDetailOperation: (detailIndex: number, opName: string, value: boolean) => void;
    onAddCustomDetail: () => void;
    onRemoveCustomDetail: (index: number) => void;
}

export const LayoutTable = ({
    details,
    extras,
    onUpdateDetail,
    onUpdateDetailOperation,
    onAddCustomDetail,
    onRemoveCustomDetail,
}: Props) => {
    return (
        <Box>
            <TableContainer>
                <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '6px 8px 6px 0' } }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ width: '16%', fontSize: '12px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase', borderBottom: '2px solid #e8eaed' }}>
                                Деталь
                            </TableCell>
                            <TableCell align="center" sx={{ width: '14%', fontSize: '12px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase', borderBottom: '2px solid #e8eaed' }}>
                                шт./лист
                            </TableCell>
                            <TableCell align="center" sx={{ width: '14%', fontSize: '12px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase', borderBottom: '2px solid #e8eaed' }}>
                                руб./лист
                            </TableCell>
                            <TableCell align="center" sx={{ width: '36%', fontSize: '10px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase', borderBottom: '2px solid #e8eaed' }}>
                                Операции
                            </TableCell>
                            <TableCell align="center" sx={{ width: '20%', borderBottom: '2px solid #e8eaed' }} />
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {details.map((d, index) => {
                            const isZero = d.countOnSheet === 0;
                            const isEnabled = d.enabled !== false;
                            return (
                                <TableRow
                                    key={index}
                                    sx={{
                                        opacity: isEnabled ? 1 : 0.4,
                                        pointerEvents: isEnabled ? 'auto' : 'none',
                                        '&:last-child td': { borderBottom: 'none' },
                                    }}
                                >
                                    {/* Detail name + enable checkbox */}
                                    <TableCell sx={{ borderBottom: '1px solid #f1f3f4' }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                            <Checkbox
                                                checked={isEnabled}
                                                onChange={(e) => onUpdateDetail(index, 'enabled', e.target.checked)}
                                                size="small"
                                                sx={{ padding: '2px', '& .MuiSvgIcon-root': { fontSize: 16 } }}
                                            />
                                            {d.isCustom ? (
                                                <TextField
                                                    value={d.name}
                                                    onChange={(e) => onUpdateDetail(index, 'name', e.target.value)}
                                                    size="small"
                                                    sx={{ width: 100, '& .MuiInputBase-input': { fontSize: '12px', padding: '4px 6px' } }}
                                                />
                                            ) : (
                                                <Typography sx={{ fontSize: '12px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                                                    {d.name}
                                                </Typography>
                                            )}
                                        </Box>
                                    </TableCell>

                                    {/* countOnSheet */}
                                    <TableCell align="center" sx={{ borderBottom: '1px solid #f1f3f4' }}>
                                        <TextField
                                            type="number"
                                            value={d.countOnSheet}
                                            onChange={(e) => onUpdateDetail(index, 'countOnSheet', parseFloat(e.target.value) || 0)}
                                            size="small"
                                            disabled={!isEnabled}
                                            inputProps={{ step: 0.001, min: 0, style: { textAlign: 'center', fontSize: '12px', width: 50 } }}
                                            sx={{
                                                '& .MuiOutlinedInput-root': {
                                                    backgroundColor: isZero ? '#f8f9fa' : '#fff',
                                                },
                                            }}
                                        />
                                    </TableCell>

                                    {/* sheetPrice */}
                                    <TableCell align="center" sx={{ borderBottom: '1px solid #f1f3f4' }}>
                                        <TextField
                                            type="number"
                                            value={d.sheetPrice}
                                            onChange={(e) => onUpdateDetail(index, 'sheetPrice', parseFloat(e.target.value) || 0)}
                                            size="small"
                                            disabled={!isEnabled}
                                            inputProps={{ step: 1, min: 0, style: { textAlign: 'center', fontSize: '12px', width: 50 } }}
                                        />
                                    </TableCell>

                                    {/* Operations: unified checkboxes for all extras (standard + custom) */}
                                    <TableCell align="center" sx={{ borderBottom: '1px solid #f1f3f4' }}>
                                        <Box sx={{ display: 'flex', justifyContent: 'center', gap: 0.5, flexWrap: 'wrap' }}>
                                            {/* Print checkbox (special — not an extra) */}
                                            <Box
                                                sx={{ display: 'flex', alignItems: 'center', gap: 0.25, cursor: isEnabled ? 'pointer' : 'default' }}
                                            >
                                                <Checkbox
                                                    checked={Boolean(d.isPrinted)}
                                                    onChange={(e) => onUpdateDetail(index, 'isPrinted', e.target.checked)}
                                                    size="small"
                                                    disabled={!isEnabled}
                                                    sx={{ padding: '2px', '& .MuiSvgIcon-root': { fontSize: 14 } }}
                                                />
                                                <Typography sx={{ fontSize: '10px', color: '#5f6368' }}>Печать</Typography>
                                            </Box>
                                            {/* All extras (standard + custom) via operations map */}
                                            {extras.map((extra, ei) => (
                                                <Box
                                                    key={ei}
                                                    sx={{ display: 'flex', alignItems: 'center', gap: 0.25, cursor: isEnabled ? 'pointer' : 'default' }}
                                                    title={extra.name}
                                                >
                                                    <Checkbox
                                                        checked={Boolean(d.operations?.[extra.name])}
                                                        onChange={(e) => onUpdateDetailOperation(index, extra.name, e.target.checked)}
                                                        size="small"
                                                        disabled={!isEnabled}
                                                        sx={{ padding: '2px', '& .MuiSvgIcon-root': { fontSize: 14 } }}
                                                    />
                                                    <Typography sx={{ fontSize: '10px', color: '#5f6368' }} title={extra.name}>
                                                        {extra.name}
                                                    </Typography>
                                                </Box>
                                            ))}
                                        </Box>
                                    </TableCell>

                                    {/* Remove button (custom only) */}
                                    <TableCell align="center" sx={{ borderBottom: '1px solid #f1f3f4' }}>
                                        {d.isCustom && (
                                            <IconButton
                                                size="small"
                                                onClick={() => onRemoveCustomDetail(index)}
                                                sx={{ color: '#d93025', opacity: 0.5, '&:hover': { opacity: 1 } }}
                                            >
                                                <CloseIcon fontSize="small" />
                                            </IconButton>
                                        )}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </TableContainer>

            <Button
                startIcon={<AddIcon />}
                onClick={onAddCustomDetail}
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
                Добавить деталь
            </Button>
        </Box>
    );
};
