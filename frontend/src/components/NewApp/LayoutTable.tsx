// frontend/src/components/NewApp/LayoutTable.tsx
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Checkbox,
    Button,
    Box,
    Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import type { Detail, Extra } from '../../types';

interface Props {
    details: Detail[];
    extras: Extra[];
    onUpdateDetail: (index: number, field: keyof Detail, value: any) => void;
    onUpdateDetailOperation: (detailIndex: number, opName: string, value: boolean) => void;
    onAddCustomDetail: () => void;
}

const OPERATION_LABELS: Record<string, string> = {
    'Печать': 'П',
    'Лак': 'Лак',
    'Тиснение': 'Тис',
    'Конгрев': 'Кон',
    'Ламинация': 'Лам',
};

export const LayoutTable = ({
    details,
    extras,
    onUpdateDetail,
    onUpdateDetailOperation,
    onAddCustomDetail,
}: Props) => {
    return (
        <Box>
            <TableContainer>
                <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '6px 8px' } }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontSize: '13px', fontWeight: 600, color: '#1a73e8', borderBottom: '2px solid #e8eaed' }}>
                                Деталь
                            </TableCell>
                            <TableCell align="center" sx={{ fontSize: '13px', fontWeight: 600, color: '#1a73e8', borderBottom: '2px solid #e8eaed', width: 80 }}>
                                Шт/Лист
                            </TableCell>
                            <TableCell align="center" sx={{ fontSize: '13px', fontWeight: 600, color: '#1a73e8', borderBottom: '2px solid #e8eaed', width: 80 }}>
                                Руб/Лист
                            </TableCell>
                            <TableCell align="center" sx={{ fontSize: '13px', fontWeight: 600, color: '#1a73e8', borderBottom: '2px solid #e8eaed' }}>
                                Дополнительные операции
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {details.map((d, index) => (
                            <TableRow
                                key={index}
                                sx={{
                                    backgroundColor: d.isCustom ? '#f8f9fa' : 'transparent',
                                    '&:last-child td': { borderBottom: 'none' },
                                }}
                            >
                                {/* Detail name */}
                                <TableCell sx={{ borderBottom: '1px solid #e8eaed' }}>
                                    <Typography
                                        sx={{
                                            fontSize: '13px',
                                            fontWeight: d.isCustom ? 400 : 500,
                                            color: d.isCustom ? '#9aa0a6' : '#202124',
                                        }}
                                    >
                                        {d.name}
                                    </Typography>
                                </TableCell>

                                {/* countOnSheet */}
                                <TableCell align="center" sx={{ borderBottom: '1px solid #e8eaed' }}>
                                    <TextField
                                        type="number"
                                        value={d.countOnSheet}
                                        onChange={(e) => onUpdateDetail(index, 'countOnSheet', parseFloat(e.target.value) || 0)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') (e.target as HTMLElement).blur();
                                        }}
                                        size="small"
                                        inputProps={{ step: 1, min: 0, style: { textAlign: 'center', fontSize: '12px', width: 50 } }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '8px',
                                                backgroundColor: '#fff',
                                            },
                                        }}
                                    />
                                </TableCell>

                                {/* sheetPrice */}
                                <TableCell align="center" sx={{ borderBottom: '1px solid #e8eaed' }}>
                                    <TextField
                                        type="number"
                                        value={d.sheetPrice}
                                        onChange={(e) => onUpdateDetail(index, 'sheetPrice', parseFloat(e.target.value) || 0)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') (e.target as HTMLElement).blur();
                                        }}
                                        size="small"
                                        inputProps={{ step: 1, min: 0, style: { textAlign: 'center', fontSize: '12px', width: 50 } }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderRadius: '8px',
                                                backgroundColor: '#fff',
                                            },
                                        }}
                                    />
                                </TableCell>

                                {/* Operations checkboxes */}
                                <TableCell align="center" sx={{ borderBottom: '1px solid #e8eaed' }}>
                                    <Box sx={{ display: 'flex', justifyContent: 'center', gap: 1 }}>
                                        {extras.map((extra) => (
                                            <Box
                                                key={extra.name}
                                                sx={{ display: 'flex', alignItems: 'center', gap: 0.25 }}
                                            >
                                                <Checkbox
                                                    checked={Boolean(d.operations?.[extra.name])}
                                                    onChange={(e) => onUpdateDetailOperation(index, extra.name, e.target.checked)}
                                                    size="small"
                                                    sx={{
                                                        '&.Mui-checked': { color: '#1a73e8' },
                                                        padding: '2px',
                                                    }}
                                                />
                                                <Typography sx={{ fontSize: '11px', color: '#5f6368' }}>
                                                    {OPERATION_LABELS[extra.name] || extra.name.charAt(0)}
                                                </Typography>
                                            </Box>
                                        ))}
                                    </Box>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            <Button
                startIcon={<AddIcon />}
                onClick={onAddCustomDetail}
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
                + Добавить деталь
            </Button>
        </Box>
    );
};
