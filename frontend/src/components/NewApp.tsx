// frontend/src/components/NewApp.tsx
import { Box, Typography, Select, MenuItem, Paper } from '@mui/material';
import { Header } from './Layout/Header';
import { ImportDataBlock } from './NewApp/ImportDataBlock';
import { LayoutTable } from './NewApp/LayoutTable';
import { CostBlock } from './NewApp/CostBlock';
import { OperationsBlock } from './NewApp/OperationsBlock';
import { PricesBlock } from './NewApp/PricesBlock';
import { ImportExportBlock } from './NewApp/ImportExportBlock';
import { useCalculator } from '../hooks/useCalculator';

/**
 * Новый UI калькулятора — строго по макету
 */
export const NewApp = () => {
    const calc = useCalculator();

    // Mock handlers for import buttons (can be connected later)
    const handleImportConstructs = () => console.log('Import constructs');
    const handleImportPrice = () => console.log('Import price');
    const handleImportPrint = () => console.log('Import print tables');
    const handleImportCalculations = () => console.log('Import calculations');
    const handleExportCalculations = () => console.log('Export calculations');

    return (
        <>
            <Header />

            <Box
                sx={{
                    px: { xs: 1, sm: 2, md: 3, lg: 4 },
                    py: 2,
                    maxWidth: '1820px',
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
                        borderRadius: '12px',
                        border: '1px solid #e8eaed',
                        backgroundColor: '#f8f9fa',
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: '12px',
                            color: '#5f6368',
                            mb: 1,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                        }}
                    >
                        Базовая коробка
                    </Typography>
                    <Select
                        value={calc.currentConstruction}
                        onChange={(e) => calc.loadConstruction(e.target.value as string)}
                        fullWidth
                        sx={{
                            backgroundColor: '#fff',
                            borderRadius: '8px',
                            '& .MuiSelect-select': {
                                fontSize: '14px',
                                py: 0.75,
                            },
                            '& .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#dadce0',
                            },
                            '&:hover .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#1a73e8',
                            },
                            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                                borderColor: '#1a73e8',
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
                        borderRadius: '12px',
                        border: '1px solid #e8eaed',
                        backgroundColor: '#fff',
                    }}
                >
                    <Typography
                        sx={{
                            fontSize: '16px',
                            fontWeight: 600,
                            color: '#1a73e8',
                            mb: 2,
                        }}
                    >
                        Раскладка деталей на лист 70х100
                    </Typography>

                    <ImportDataBlock
                        onImportConstructs={handleImportConstructs}
                        onImportPrice={handleImportPrice}
                        onImportPrint={handleImportPrint}
                    />

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
                    />

                    {/* Правая колонка: Дополнительные операции + Цены */}
                    <Box>
                        <OperationsBlock
                            extras={calc.extras}
                            printSettings={calc.printSettings}
                            printTables={calc.printTables}
                            onUpdateExtra={calc.updateExtra}
                            onAddCustomExtra={calc.addCustomExtra}
                            onUpdatePrintSettings={calc.updatePrintSettings}
                        />

                        <PricesBlock
                            prices={calc.result?.prices || []}
                            onUpdatePriceList={calc.updatePriceList}
                            onCalculate={calc.calculate}
                            loading={calc.loading}
                        />
                    </Box>
                </Box>

                {/* 4. Блок "Импорт/экспорт расчетов" */}
                <ImportExportBlock
                    onImport={handleImportCalculations}
                    onExport={handleExportCalculations}
                />
            </Box>
        </>
    );
};
