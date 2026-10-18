// frontend/src/components/Calculator/PriceTable.tsx
import {
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    TextField,
    Box,
    Typography,
} from '@mui/material';
import type { PriceRow } from '../../types';
import { numberInputSx, numberInputProps } from '../../styles/uiStyles';

interface Props {
    prices: PriceRow[];
    branch: string;
    basePrice: number;
    onUpdatePriceList: (label: string, value: number) => void;
    loading: boolean;
}

export const PriceTable = ({ prices, branch, basePrice, onUpdatePriceList }: Props) => {
    return (
        <Box>
            {/* Branch info */}
            <Box
                sx={{
                    fontSize: '15px',
                    padding: '8px 12px',
                    backgroundColor: '#e8f0fe',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    flexWrap: 'wrap',
                }}
            >
                <Typography sx={{ fontSize: '15px' }}>
                    Выбрана ветка: <span style={{ fontWeight: 500, color: '#1a73e8' }}>{branch}</span>
                </Typography>
                <Typography sx={{ fontSize: '15px', color: '#5f6368' }}>
                    (базовая цена = {basePrice.toFixed(2)} ₽)
                </Typography>
                <Typography sx={{ fontSize: '15px', color: '#5f6368' }}>
                    {branch === '×3'
                        ? '→ применяется коэффициент в зависимости от тиража'
                        : '→ применяется скидка в рублях'}
                </Typography>
            </Box>

            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontSize: '14px', fontWeight: 500, color: '#5f6368', borderBottom: '1px solid #e8eaed' }}>
                                Тираж
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '14px', fontWeight: 500, color: '#5f6368', borderBottom: '1px solid #e8eaed' }}>
                                Без НДС
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '14px', fontWeight: 500, color: '#5f6368', borderBottom: '1px solid #e8eaed' }}>
                                С НДС 11%
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '14px', fontWeight: 500, color: '#d93025', borderBottom: '1px solid #e8eaed' }}>
                                Прайс (₽)
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '14px', fontWeight: 500, color: '#1a73e8', borderBottom: '1px solid #e8eaed' }}>
                                Итог
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {prices.map((row, index) => (
                            <TableRow
                                key={index}
                                sx={{
                                    backgroundColor: row.isBase ? '#fff8e6' : 'transparent',
                                    '& td': { borderBottom: '1px solid #f1f3f4' },
                                }}
                            >
                                <TableCell sx={{ fontSize: '15px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        {row.label}
                                        {row.isBase && (
                                            <Typography sx={{ fontSize: '13px', color: '#5f6368' }}>Базовая</Typography>
                                        )}
                                        {row.isPriceListUsed && (
                                            <Typography sx={{ fontSize: '12px', color: '#d93025', fontWeight: 500, ml: 0.5 }}>
                                                Прайс
                                            </Typography>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: '16px', fontWeight: 500 }}>
                                    {row.withoutVAT.toFixed(2)} ₽
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: '16px', fontWeight: 600, color: '#137333' }}>
                                    {row.calculatedPrice} ₽
                                </TableCell>
                                <TableCell align="right">
                                    <TextField
                                        type="number"
                                        value={row.priceListPrice}
                                        onChange={(e) => onUpdatePriceList(row.label, parseInt(e.target.value) || 0)}
                                        size="small"
                                        inputProps={{ ...numberInputProps(1), style: { ...numberInputProps().style, fontSize: '14px', width: 50 } }}
                                        sx={{
                                            ...numberInputSx,
                                            '& .MuiOutlinedInput-root': {
                                                ...((numberInputSx as any)['& .MuiOutlinedInput-root'] || {}),
                                                fontSize: '14px',
                                                borderColor: row.priceListPrice > 0 ? '#d93025' : '#dadce0',
                                                backgroundColor: row.priceListPrice > 0 ? '#fce8e6' : '#fff',
                                            },
                                        }}
                                    />
                                </TableCell>
                                <TableCell
                                    align="right"
                                    sx={{
                                        fontSize: '16px',
                                        fontWeight: 700,
                                        color: row.isPriceListUsed ? '#d93025' : '#137333',
                                    }}
                                >
                                    {row.finalPrice} ₽
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};
