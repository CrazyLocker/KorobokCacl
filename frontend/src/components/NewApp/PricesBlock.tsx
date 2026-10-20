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
    TextField,
} from '@mui/material';
import type { PriceRow } from '../../types';
import { numberInputSx, numberInputProps } from '../../styles/uiStyles';
import { tokens } from '../../theme';

interface Props {
    prices: PriceRow[];
    onUpdatePriceList: (label: string, value: number) => void;
    loading: boolean;
    totalCost?: number; // себестоимость коробки
}

const TIER_LABELS = ['до 9', '10–49', '50–199', '200–499', '500–699', '700–1499', 'от 1500'];

const tableHeadCellSx = {
    fontSize: '11px',
    fontWeight: 600,
    color: tokens.color.accent,
    borderBottom: `1px solid ${tokens.color.border}`,
};

export const PricesBlock = ({ prices, onUpdatePriceList, totalCost = 0 }: Props) => {
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
                backgroundColor: tokens.color.surface,
                borderRadius: `${tokens.radius.panel}px`,
                border: `1px solid ${tokens.color.border}`,
                p: 2,
            }}
        >
            {/* Header */}
            <Box
                sx={{
                    mb: 2,
                    pb: 1,
                    borderBottom: `2px solid ${tokens.color.accent}`,
                    textAlign: 'left',
                }}
            >
                <Typography
                    sx={{
                        fontSize: '14px',
                        fontWeight: 600,
                        color: tokens.color.ink,
                        textAlign: 'left',
                    }}
                >
                    Цена коробки
                </Typography>
            </Box>

            {/* Price table */}
            <TableContainer sx={{ textAlign: 'left' }}>
                <Table
                    size="small"
                    sx={{
                        fontVariantNumeric: 'tabular-nums',
                        '& .MuiTableCell-root': { padding: '4px 8px', fontSize: '12px' },
                    }}
                >
                    <TableHead>
                        <TableRow>
                            <TableCell sx={{ ...tableHeadCellSx, textAlign: 'left' }}>
                                Тираж
                            </TableCell>
                            <TableCell align="right" sx={tableHeadCellSx}>
                                с НДС 11%
                            </TableCell>
                            <TableCell align="right" sx={tableHeadCellSx}>
                                Прайс (₽)
                            </TableCell>
                            <TableCell align="right" sx={tableHeadCellSx}>
                                Итог
                            </TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {displayPrices.map((row, index) => (
                            <TableRow
                                key={index}
                                sx={{
                                    backgroundColor: row.isBase ? tokens.color.warningSoft : 'transparent',
                                    '& td': { borderBottom: `1px solid ${tokens.color.border}` },
                                }}
                            >
                                <TableCell sx={{ fontSize: '12px', fontWeight: row.isBase ? 600 : 400, textAlign: 'left' }}>
                                    {row.label}
                                    {row.isBase && (
                                        <Typography component="span" sx={{ fontSize: '10px', color: tokens.color.inkMuted, ml: 0.5 }}>
                                            (базовая)
                                        </Typography>
                                    )}
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: '12px', fontWeight: 500 }}>
                                    {row.calculatedPrice > 0 ? `${row.calculatedPrice} ₽` : '—'}
                                </TableCell>
                                <TableCell align="right" sx={{ fontSize: '12px' }}>
                                    <TextField
                                        type="number"
                                        value={row.priceListPrice || ''}
                                        onChange={(e) => onUpdatePriceList(row.label, parseInt(e.target.value) || 0)}
                                        size="small"
                                        inputProps={{ ...numberInputProps(1), style: { ...numberInputProps().style, width: 60 } }}
                                        sx={numberInputSx}
                                    />
                                </TableCell>
                                <TableCell
                                    align="right"
                                    sx={{
                                        fontSize: '13px',
                                        fontWeight: 700,
                                        color: row.isPriceListUsed ? tokens.color.error : tokens.color.success,
                                    }}
                                >
                                    {row.finalPrice > 0 ? `${row.finalPrice} ₽` : '—'}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {/* Box cost info */}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5, pt: 1.5, borderTop: `1px solid ${tokens.color.border}` }}>
                <Typography sx={{ fontSize: '13px', fontWeight: 600, color: tokens.color.ink, textAlign: 'left' }}>
                    Себестоимость коробки
                </Typography>
                <Typography
                    sx={{
                        fontSize: '14px',
                        fontWeight: 700,
                        color: tokens.color.accent,
                        fontVariantNumeric: 'tabular-nums',
                        textAlign: 'left',
                    }}
                >
                    {totalCost.toFixed(2)} руб.
                </Typography>
            </Box>
        </Box>
    );
};
