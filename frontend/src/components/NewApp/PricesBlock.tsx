// frontend/src/components/NewApp/PricesBlock.tsx
import {
    Box,
    Typography,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Button,
    CircularProgress,
    TextField,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import type { PriceRow } from '../../types';

interface Props {
    prices: PriceRow[];
    onUpdatePriceList: (label: string, value: number) => void;
    onCalculate: () => void;
    loading: boolean;
}

const TIER_LABELS = ['до 9', '10–49', '50–199', '200–499', '500–699', '700–1499', 'от 1500'];

export const PricesBlock = ({ prices, onUpdatePriceList, onCalculate, loading }: Props) => {
    const displayPrices = prices.length > 0 ? prices : TIER_LABELS.map((label) => ({
        label,
        withoutVAT: 0,
        calculatedPrice: 0,
        priceListPrice: 0,
        finalPrice: 0,
        isBase: label === '10–49',
        isPriceListUsed: false,
    }));

    return (
        <Box
            sx={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid #e8eaed',
                p: 2,
            }}
        >
            {/* Header with Calculate button */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    mb: 2,
                    pb: 1,
                    borderBottom: '2px solid #1a73e8',
                }}
            >
                <Typography
                    sx={{
                        fontSize: '16px',
                        fontWeight: 600,
                        color: '#202124',
                    }}
                >
                    Цены для клиента
                </Typography>
                <Button
                    variant="contained"
                    startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                    onClick={onCalculate}
                    disabled={loading}
                    size="small"
                    sx={{
                        backgroundColor: '#1a73e8',
                        borderRadius: '8px',
                        padding: '4px 12px',
                        fontWeight: 500,
                        fontSize: '12px',
                        textTransform: 'none',
                        '&:hover': { backgroundColor: '#1557b0' },
                    }}
                >
                    Рассчитать
                </Button>
            </Box>

            {/* Price table */}
            <TableContainer>
                <Table size="small" sx={{ '& .MuiTableCell-root': { padding: '6px 8px' } }}>
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ fontSize: '12px', fontWeight: 600, color: '#1a73e8', borderBottom: '2px solid #e8eaed' }}>
                                Тираж
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 600, color: '#1a73e8', borderBottom: '2px solid #e8eaed' }}>
                                с НДС 11%
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 600, color: '#1a73e8', borderBottom: '2px solid #e8eaed' }}>
                                Прайс (₽)
                            </TableCell>
                            <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 600, color: '#1a73e8', borderBottom: '2px solid #e8eaed' }}>
                                Итог
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {displayPrices.map((row, index) => (
                            <TableRow
                                key={index}
                                sx={{
                                    backgroundColor: row.isBase ? '#fff8e1' : 'transparent',
                                    '& td': { borderBottom: '1px solid #f1f3f4' },
                                }}
                            >
                                <TableCell sx={{ fontSize: '13px', fontWeight: row.isBase ? 600 : 400 }}>
                                    {row.label}
                                    {row.isBase && (
                                        <Typography component="span" sx={{ fontSize: '10px', color: '#5f6368', ml: 0.5 }}>
                                            (базовая)
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: '13px', fontWeight: 500 }}>
                                    {row.calculatedPrice > 0 ? `${row.calculatedPrice} ₽` : '—'}
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: '13px' }}>
                                    <TextField
                                        type="number"
                                        value={row.priceListPrice || ''}
                                        onChange={(e) => onUpdatePriceList(row.label, parseInt(e.target.value) || 0)}
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
                                <TableCell
                                    align="right"
                                    sx={{
                                        fontSize: '14px',
                                        fontWeight: 700,
                                        color: row.isPriceListUsed ? '#d93025' : '#137333',
                                    }}
                                >
                                    {row.finalPrice > 0 ? `${row.finalPrice} ₽` : '—'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>
        </Box>
    );
};
