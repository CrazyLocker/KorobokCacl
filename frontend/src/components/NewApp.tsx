// frontend/src/components/NewApp.tsx
import { Box, Typography, Select, MenuItem, Paper } from '@mui/material';
import { Header } from './Layout/Header';
import { ViewToggle } from './Layout/ViewToggle';
import type { AppView } from './Layout/ViewToggle';
import { LayoutTable } from './NewApp/LayoutTable';
import { CostBlock } from './NewApp/CostBlock';
import { OperationsBlock } from './NewApp/OperationsBlock';
import { PricesBlock } from './NewApp/PricesBlock';
import { useCalculator } from '../hooks/useCalculator';
import { tokens } from '../theme';

interface NewAppProps {
    view: AppView;
    onViewChange: (event: React.MouseEvent<HTMLElement>, value: AppView | null) => void;
}

/**
 * Новый UI калькулятора — строго по макету
 */
export const NewApp = ({ view, onViewChange }: NewAppProps) => {
    const calc = useCalculator();

    return (
        <>
            <Header actions={<ViewToggle view={view} onChange={onViewChange} />} />

            <Box
                sx={{
                    px: { xs: 1, sm: 2, md: 3, lg: 4 },
                    py: 2,
                    maxWidth: '2730px',
                    mx: 'auto',
                    width: '100%',
                    boxSizing: 'border-box',
                }}
            >
                {/* 1. Блок "Базовая коробка" */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 2,
                        mb: 2,
                        borderRadius: `${tokens.radius.panel}px`,
                        border: `1px solid ${tokens.color.border}`,
                        backgroundColor: tokens.color.surfaceSubtle,
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: '12px',
                            color: tokens.color.inkMuted,
                            mb: 1,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            textAlign: 'left',
                        }}
                    >
                        Базовая коробка
                    </Typography>
                    <Select
                        value={calc.currentConstruction}
                        onChange={(e) => calc.loadConstruction(e.target.value as string)}
                        fullWidth
                        sx={{
                            backgroundColor: tokens.color.surface,
                            borderRadius: `${tokens.radius.field}px`,
                            '& .MuiSelect-select': {
                                fontSize: '14px',
                                py: 0.75,
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: tokens.color.borderStrong,
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: tokens.color.accent,
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                borderColor: tokens.color.accent,
                                borderWidth: '2px',
                            },
                        }}
                    >
                        {calc.constructs.map((c) => (
                            <MenuItem key={c.id} value={c.name} sx={{ fontSize: '14px' }}>
                                {c.name}
                            </MenuItem>
                        ))}
                    </Select>
                </Paper>

                {/* 2. Блок "Раскладка деталей на лист 70х100" */}
                <Paper
                    elevation={0}
                    sx={{
                        p: 2,
                        mb: 2,
                        borderRadius: `${tokens.radius.panel}px`,
                        border: `1px solid ${tokens.color.border}`,
                        backgroundColor: tokens.color.surface,
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: tokens.color.accent,
                            mb: 2,
                        }}
                    >
                        Раскладка деталей на лист 70х100
                    </Typography>

                    <LayoutTable
                        details={calc.details}
                        extras={calc.extras}
                        onUpdateDetail={calc.updateDetail}
                        onUpdateDetailOperation={calc.updateDetailOperation}
                        onAddCustomDetail={calc.addCustomDetail}
                    />
                </Paper>

                {/* 3. Две колонки: Себестоимость | Дополнительные операции + Цены */}
                <Box
                    sx={{
                        display: 'grid',
                        gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                        gap: 2,
                        mb: 2,
                    }}
                >
                    {/* Левая колонка: Себестоимость */}
                    <CostBlock
                        details={calc.details}
                        extras={calc.extras}
                        workPrice={calc.workPrice}
                        onWorkPriceChange={calc.setWorkPrice}
                        printCostPerUnit={calc.result?.printCostPerUnit ?? 0}
                    />

                    {/* Правая колонка: Цены + Дополнительные операции */}
                    <Box>
                        <PricesBlock
                            prices={calc.result?.prices || []}
                            onUpdatePriceList={calc.updatePriceList}
                            loading={calc.loading}
                            totalCost={calc.result?.totalCost}
                        />

                        <OperationsBlock
                            extras={calc.extras}
                            printSettings={calc.printSettings}
                            printTables={calc.printTables}
                            onUpdateExtra={calc.updateExtra}
                            onAddCustomExtra={calc.addCustomExtra}
                            onUpdatePrintSettings={calc.updatePrintSettings}
                        />
                    </Box>
                </Box>
            </Box>
        </>
    );
};
