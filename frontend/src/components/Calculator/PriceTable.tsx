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
import StarIcon from '@mui/icons-material/Star';
import type { PriceRow } from '../../types';

interface Props {
    prices: PriceRow[];
    branch: string;
    basePrice: number;
    onUpdatePriceList: (label: string, value: number) => void;
}

export const PriceTable = ({ prices, branch, basePrice, onUpdatePriceList }: Props) => {
    return (
        <Box>
            {/* Branch info */}
            <Box
                sx={{
                    fontSize: '13px',
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
                <Typography sx={{ fontSize: '13px' }}>
                    Выбрана ветка: <span style={{ fontWeight: 500, color: '#1a73e8' }}>{branch}</span>
                </Typography>
                <Typography sx={{ fontSize: '13px', color: '#5f6368' }}>
                    (базовая цена = {basePrice.toFixed(2)} ₽)
                </Typography>
                <Typography sx={{ fontSize: '13px', color: '#5f6368' }}>
                    {branch === '×3'
                        ? '→ применяется коэффициент в зависимости от тиража'
                        : '→ применяется скидка в рублях'}
                </Typography>
            </Box>

            <TableContainer>
                <Table size="small">
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase', borderBottom: '1px solid #e8eaed' }}>
                                Тираж
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase', borderBottom: '1px solid #e8eaed' }}>
                                Без НДС
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 500, color: '#5f6368', textTransform: 'uppercase', borderBottom: '1px solid #e8eaed' }}>
                                С НДС 11%
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 500, color: '#d93025', textTransform: 'uppercase', borderBottom: '1px solid #e8eaed' }}>
                                Прайс (₽)
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 500, color: '#1a73e8', textTransform: 'uppercase', borderBottom: '1px solid #e8eaed' }}>
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
                                <TableCell sx={{ fontSize: '13px' }}>
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                        {row.label}
                                        {row.isBase && <StarIcon sx={{ fontSize: 16, color: '#fbbc04' }} />}
                                        {row.isBase && (
                                            <Typography sx={{ fontSize: '11px', color: '#5f6368' }}>базовая</Typography>
                                        )}
                                        {row.isPriceListUsed && (
                                            <Typography sx={{ fontSize: '10px', color: '#d93025', fontWeight: 500, ml: 0.5 }}>
                                                📋 прайс
                                            </Typography>
                                        )}
                                    </Box>
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: '14px', fontWeight: 500 }}>
                                    {row.withoutVAT.toFixed(2)} ₽
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: '14px', fontWeight: 600, color: '#137333' }}>
                                    {row.calculatedPrice} ₽
                                </TableCell>
                                <TableCell align="right">
                                    <TextField
                                        type="number"
                                        value={row.priceListPrice}
                                        onChange={(e) => onUpdatePriceList(row.label, parseInt(e.target.value) || 0)}
                                        size="small"
                                        inputProps={{ step: 1, min: 0, style: { textAlign: 'center', fontSize: '12px', width: 50 } }}
                                        sx={{
                                            '& .MuiOutlinedInput-root': {
                                                borderColor: row.priceListPrice > 0 ? '#d93025' : '#dadce0',
                                                backgroundColor: row.priceListPrice > 0 ? '#fce8e6' : '#fff',
                                            },
                                        }}
                                    />
                                </TableCell>
                                <TableCell
                                    align="right"
                                    sx={{
                                        fontSize: '14px',
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
