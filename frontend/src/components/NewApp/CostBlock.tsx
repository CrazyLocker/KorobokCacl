// frontend/src/components/NewApp/CostBlock.tsx
import { Box, Typography, TextField } from '@mui/material';
import type { Detail, Extra } from '../../types';

interface Props {
    details: Detail[];
    extras: Extra[];
    workPrice: number;
    onWorkPriceChange: (value: number) => void;
}

/**
 * Вычисляет себестоимость детали по формуле:
 * (Руб/Лист / Шт/Лист) + работа + печать
 */
    const calculateDetailCost = (
    detail: Detail,
    extras: Extra[],
    workPrice: number,
    printCost: number
): number => {
    const materialCost = detail.countOnSheet > 0
        ? detail.sheetPrice / detail.countOnSheet
        : 0;
    const extraCost = extras.reduce((sum, extra) => {
        return sum + (detail.operations?.[extra.name] ? extra.cost : 0);
    }, 0);
    return materialCost + workPrice + extraCost + (detail.isPrinted ? printCost : 0);
};

export const CostBlock = ({ details, extras, workPrice, onWorkPriceChange }: Props) => {
    // Find print extra cost
    const printExtra = extras.find(e => e.name === 'Печать' || e.name === 'Лак');
    const printCost = printExtra?.cost || 55;

    const activeDetails = details.filter(d => d.enabled && d.countOnSheet > 0);
    const totalBoxCost = activeDetails.reduce((sum, d) => sum + calculateDetailCost(d, extras, workPrice, printCost), 0);

    return (
        <Box
            sx={{
                backgroundColor: '#fff',
                borderRadius: '12px',
                border: '1px solid #e8eaed',
                p: 2,
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
                Себестоимость деталей / Коробки
            </Typography>

            {/* Details list */}
            <Box sx={{ mb: 2 }}>
                {activeDetails.map((d, i) => {
                    const materialCost = d.countOnSheet > 0 ? d.sheetPrice / d.countOnSheet : 0;
                    const extraCost = extras.reduce((sum, extra) => {
                        return sum + (d.operations?.[extra.name] ? extra.cost : 0);
                    }, 0);
                    const detailCost = calculateDetailCost(d, extras, workPrice, printCost);

                    // Build formula text
                    const formulaParts: string[] = [];
                    if (materialCost > 0) {
                        formulaParts.push(`${d.sheetPrice}/${d.countOnSheet}=${materialCost.toFixed(2)}`);
                    }
                    if (workPrice > 0) {
                        formulaParts.push(`работа ${workPrice}`);
                    }
                    if (d.isPrinted && printCost > 0) {
                        formulaParts.push(`Печать ${printCost}`);
                    }
                    formulaParts.push(`+ ${extraCost.toFixed(2)} доп.`);

                    return (
                        <Box
                            key={i}
                            sx={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                py: 0.75,
                                borderBottom: i < activeDetails.length - 1 ? '1px solid #f1f3f4' : 'none',
                            }}
                        >
                            <Box sx={{ flex: 1 }}>
                                <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#202124', mb: 0.25 }}>
                                    {d.name}
                                </Typography>
                                <Typography sx={{ fontSize: '11px', color: '#5f6368', fontFamily: 'monospace' }}>
                                    ({formulaParts.join(' + ')})
                                </Typography>
                            </Box>
                            <Typography
                                sx={{
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    color: '#1a73e8',
                                    whiteSpace: 'nowrap',
                                }}
                            >
                                {detailCost.toFixed(2)} руб.
                            </Typography>
                        </Box>
                    );
                })}
            </Box>

            {/* Work price */}
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                    mb: 2,
                    p: 1.5,
                    backgroundColor: '#f8f9fa',
                    borderRadius: '8px',
                }}
            >
                <Typography sx={{ fontSize: '13px', color: '#5f6368' }}>
                    Работа/деталь
                </Typography>
                <TextField
                    type="number"
                    value={workPrice}
                    onChange={(e) => onWorkPriceChange(parseFloat(e.target.value) || 0)}
                    size="small"
                    inputProps={{ step: 0.5, min: 0, style: { fontSize: '12px', width: 50, textAlign: 'center' } }}
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
            </Box>

            {/* Total box cost */}
            <Box
                sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    pt: 1.5,
                    borderTop: '2px solid #1a73e8',
                }}
            >
                <Typography sx={{ fontSize: '15px', fontWeight: 600, color: '#202124' }}>
                    Коробка
                </Typography>
                <Typography sx={{ fontSize: '18px', fontWeight: 700, color: '#1a73e8' }}>
                    {totalBoxCost.toFixed(2)} руб.
                </Typography>
            </Box>
        </Box>
    );
};
