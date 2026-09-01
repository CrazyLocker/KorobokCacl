// frontend/src/App.tsx
import { useState } from 'react';
import { Container, Paper, Box, Typography, Button, Divider, CircularProgress, Alert, ToggleButton, ToggleButtonGroup } from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import BuildIcon from '@mui/icons-material/Build';
import FormatItalicIcon from '@mui/icons-material/FormatItalic';
import { Header } from './components/Layout/Header';
import { ConstructionSelector } from './components/Calculator/ConstructionSelector';
import { LayoutTable } from './components/Calculator/LayoutTable';
import { ExtrasBlock } from './components/Calculator/ExtrasBlock';
import { PriceTable } from './components/Calculator/PriceTable';
import { useCalculator } from './hooks/useCalculator';
import { NewApp } from './components/NewApp';
import './App.css';

function App() {
    const calc = useCalculator();
    const [view, setView] = useState<'classic' | 'new'>('classic');

    const handleViewChange = (_: React.MouseEvent<HTMLElement>, newView: 'classic' | 'new') => {
        if (newView !== null) setView(newView);
    };

    return (
        <>
            {view === 'new' ? (
                <NewApp />
            ) : (
                <>
                    <Header activeTab="Коробка" onTabChange={() => {}} />
                    <Box
                        sx={{
                            display: 'flex',
                            justifyContent: 'flex-end',
                            px: { xs: 1, sm: 1.5, md: 2, lg: 3 },
                            pt: 1.5,
                        }}
                    >
                        <ToggleButtonGroup
                            value={view}
                            exclusive
                            onChange={handleViewChange}
                            size="small"
                            sx={{
                                backgroundColor: '#f8f9fa',
                                borderRadius: '20px',
                                border: '1px solid #e8eaed',
                            }}
                        >
                            <ToggleButton value="classic" sx={{
                                fontSize: '12px',
                                textTransform: 'none',
                                px: 2,
                                py: 0.5,
                                borderRadius: '20px',
                                '&.Mui-selected': {
                                    backgroundColor: '#1a73e8',
                                    color: '#fff',
                                    '&:hover': { backgroundColor: '#1557b0' },
                                },
                            }}>
                                Классический
                            </ToggleButton>
                            <ToggleButton value="new" sx={{
                                fontSize: '12px',
                                textTransform: 'none',
                                px: 2,
                                py: 0.5,
                                borderRadius: '20px',
                                '&.Mui-selected': {
                                    backgroundColor: '#1a73e8',
                                    color: '#fff',
                                    '&:hover': { backgroundColor: '#1557b0' },
                                },
                            }}>
                                <FormatItalicIcon sx={{ fontSize: 16, mr: 0.5 }} />
                                Новый UI
                            </ToggleButton>
                        </ToggleButtonGroup>
                    </Box>
                    <Container
                        maxWidth={false}
                        sx={{
                            mt: { xs: 1.5, sm: 2, md: 3 },
                            px: { xs: 1, sm: 1.5, md: 2, lg: 3 },
                            maxWidth: {
                                xs: '100%',
                                sm: '100%',
                                md: '98%',
                                lg: '95%',
                                xl: '1600px'
                            },
                            mx: 'auto'
                        }}
                    >
                        <Paper
                            elevation={0}
                            sx={{
                                p: { xs: 1.5, sm: 2, md: 3, lg: 4 },
                                borderRadius: { xs: '8px', sm: '10px', md: '12px' },
                                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
                            }}
                        >
                            {/* Title */}
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 2 }, mb: 1 }}>
                                <Typography variant="h5" sx={{ fontWeight: 500, fontSize: { xs: '18px', sm: '20px', md: '24px' } }}>
                                    Калькулятор стоимости коробки
                                </Typography>
                            </Box>

                            {/* Subtitle */}
                            <Box
                                sx={{
                                    mb: 3,
                                    p: { xs: 1, sm: 1.5 },
                                    pl: { xs: 1.5, sm: 2 },
                                    backgroundColor: '#e8f0fe',
                                    borderRadius: { xs: '6px', sm: '8px' },
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 1,
                                    flexWrap: 'wrap',
                                }}
                            >
                                <Typography sx={{ fontSize: { xs: '12px', sm: '13px', md: '14px' }, color: '#5f6368' }}>
                                    Выбор базовой конструкции · Печать · Лак · Конгрев · Тиснение · Ламинация
                                </Typography>
                            </Box>

                            {/* Construction selector */}
                            <ConstructionSelector
                                constructs={calc.constructs}
                                value={calc.currentConstruction}
                                onChange={(name) => calc.loadConstruction(name)}
                                additionalConstruct={calc.individualConstruction}
                            />

                            {/* Settings panel: layout table */}
                            <Box
                                sx={{
                                    backgroundColor: '#f8f9fa',
                                    borderRadius: { xs: '8px', sm: '10px', md: '12px' },
                                    p: { xs: 1.5, sm: 2, md: 3 },
                                    mb: 3,
                                    border: '1px solid #e8eaed',
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: { xs: '11px', sm: '12px', md: '13px' },
                                        fontWeight: 500,
                                        color: '#5f6368',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.05em',
                                        mb: 1.5,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                    }}
                                >
                                    Раскладка на лист 100×70
                                </Typography>
                                <LayoutTable
                                    details={calc.details}
                                    extras={calc.extras}
                                    onUpdateDetail={calc.updateDetail}
                                    onUpdateDetailOperation={calc.updateDetailOperation}
                                    onAddCustomDetail={calc.addCustomDetail}
                                    onRemoveCustomDetail={calc.removeCustomDetail}
                                />
                            </Box>

                            {/* Row: Details + Extras (2 columns) */}
                            <Box sx={{
                                display: 'grid',
                                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                                gap: { xs: 2, sm: 2.5, md: 3 },
                                mb: 3,
                                minWidth: 0,
                            }}>
                                {/* Left column: Детали */}
                                <Box
                                    sx={{
                                        backgroundColor: '#f8f9fa',
                                        borderRadius: { xs: '8px', sm: '10px', md: '12px' },
                                        p: { xs: 1.5, sm: 2, md: 2.5 },
                                        border: '1px solid #e8eaed',
                                        overflow: 'hidden',
                                        minWidth: 0,
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: { xs: '13px', sm: '14px', md: '15px' },
                                            fontWeight: 500,
                                            mb: 1.5,
                                            pb: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            borderBottom: '1px solid #e8eaed',
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        Детали
                                        <Box sx={{
                                            ml: { xs: 0, sm: 'auto' },
                                            backgroundColor: '#1a73e8',
                                            color: '#fff',
                                            fontSize: { xs: '9px', sm: '10px' },
                                            fontWeight: 500,
                                            px: 1.5,
                                            py: 0.25,
                                            borderRadius: '16px',
                                            whiteSpace: 'nowrap',
                                        }}>
                                            материал + работа
                                        </Box>
                                    </Typography>

                                    {calc.details.filter((d) => d.enabled && d.countOnSheet > 0).length === 0 ? (
                                        <Typography sx={{ color: '#9aa0a6', fontSize: '13px', py: 1 }}>
                                            Нет активных деталей для выбранной конструкции
                                        </Typography>
                                    ) : (
                                        calc.details
                                            .filter((d) => d.enabled && d.countOnSheet > 0)
                                            .map((d, i) => {
                                                const materialCost = d.sheetPrice / d.countOnSheet;
                                                const costPrice = materialCost + calc.workPrice;
                                                let extraCost = 0;
                                                const labels: string[] = [];
                                                if (d.operations) {
                                                    for (const [opName, enabled] of Object.entries(d.operations)) {
                                                        if (enabled) {
                                                            const e = calc.extras.find((x) => x.name === opName);
                                                            if (e) {
                                                                extraCost += e.cost;
                                                                labels.push(e.name.toLowerCase());
                                                            }
                                                        }
                                                    }
                                                }
                                                const finalCost = costPrice + extraCost;
                                                return (
                                                    <Box
                                                        key={i}
                                                        sx={{
                                                            display: 'flex',
                                                            flexDirection: { xs: 'column', sm: 'row' },
                                                            justifyContent: 'space-between',
                                                            alignItems: { xs: 'flex-start', sm: 'center' },
                                                            py: 0.75,
                                                            borderBottom: '1px solid #e8eaed',
                                                            gap: { xs: 0.5, sm: 0 }
                                                        }}
                                                    >
                                                        <Typography sx={{
                                                            fontSize: { xs: '12px', sm: '13px' },
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: 0.5,
                                                            flexWrap: 'wrap',
                                                            whiteSpace: 'nowrap',
                                                        }}>
                                                            {d.name}
                                                            <Box component="span" sx={{
                                                                fontSize: { xs: '9px', sm: '10px', md: '11px' },
                                                                color: '#9aa0a6',
                                                                whiteSpace: 'nowrap',
                                                            }}>
                                                                ({d.sheetPrice}/{d.countOnSheet}={materialCost.toFixed(2)}+{calc.workPrice}
                                                                {extraCost > 0 ? `+${labels.join('+')}${extraCost.toFixed(2)}` : ''})
                                                            </Box>
                                                        </Typography>
                                                        <Typography
                                                            sx={{
                                                                fontSize: { xs: '12px', sm: '13px', md: '14px' },
                                                                fontWeight: 500,
                                                                backgroundColor: '#fff',
                                                                px: { xs: 1.5, sm: 2 },
                                                                py: 0.25,
                                                                borderRadius: '20px',
                                                                boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                                                                alignSelf: { xs: 'flex-end', sm: 'auto' },
                                                                whiteSpace: 'nowrap',
                                                            }}
                                                        >
                                                            {finalCost.toFixed(2)} <Box component="span" sx={{ fontSize: { xs: '9px', sm: '10px', md: '11px' }, fontWeight: 400, color: '#9aa0a6' }}>руб.</Box>
                                                        </Typography>
                                                    </Box>
                                                );
                                            })
                                    )}

                                    {/* Work price */}
                                    <Box
                                        sx={{
                                            mt: 1.5,
                                            p: { xs: 1, sm: 1.5 },
                                            backgroundColor: '#fff',
                                            borderRadius: '8px',
                                            border: '1px solid #e8eaed',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: { xs: 1, sm: 1.5 },
                                            flexWrap: 'wrap',
                                        }}
                                    >
                                        <Typography sx={{
                                            fontWeight: 500,
                                            fontSize: { xs: '12px', sm: '13px' },
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 0.5,
                                            whiteSpace: 'nowrap',
                                        }}>
                                            <BuildIcon sx={{ fontSize: { xs: 14, sm: 16 } }} />
                                            Работа
                                        </Typography>
                                        <input
                                            type="number"
                                            value={calc.workPrice}
                                            step={0.5}
                                            min={0}
                                            onChange={(e) => calc.setWorkPrice(parseFloat(e.target.value) || 0)}
                                            style={{
                                                width: 60,
                                                padding: '4px 6px',
                                                border: '1px solid #dadce0',
                                                borderRadius: '6px',
                                                fontSize: '12px',
                                                textAlign: 'center',
                                                fontFamily: 'inherit',
                                            }}
                                        />
                                        <Typography sx={{ color: '#5f6368', fontSize: { xs: '10px', sm: '11px' }, whiteSpace: 'nowrap' }}>руб./деталь</Typography>
                                    </Box>
                                </Box>

                                {/* Right column: Дополнительные операции */}
                                <Box
                                    sx={{
                                        backgroundColor: '#f8f9fa',
                                        borderRadius: { xs: '8px', sm: '10px', md: '12px' },
                                        p: { xs: 1.5, sm: 2, md: 2.5 },
                                        border: '1px solid #e8eaed',
                                        overflow: 'hidden',
                                        minWidth: 0,
                                    }}
                                >
                                    <Typography
                                        sx={{
                                            fontSize: { xs: '13px', sm: '14px', md: '15px' },
                                            fontWeight: 500,
                                            mb: 1.5,
                                            pb: 1,
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 1,
                                            borderBottom: '1px solid #e8eaed',
                                        }}
                                    >
                                        Дополнительные операции
                                    </Typography>
                                    <ExtrasBlock
                                        extras={calc.extras}
                                        printSettings={calc.printSettings}
                                        printTables={calc.printTables}
                                        onUpdateExtra={calc.updateExtra}
                                        onAddCustomExtra={calc.addCustomExtra}
                                        onRemoveCustomExtra={calc.removeCustomExtra}
                                        onUpdatePrintSettings={calc.updatePrintSettings}
                                    />
                                </Box>
                            </Box>

                            {/* 3. Цены для клиента (во всю ширину) */}
                            <Box
                                sx={{
                                    backgroundColor: '#f8f9fa',
                                    borderRadius: { xs: '8px', sm: '10px', md: '12px' },
                                    p: { xs: 1.5, sm: 2, md: 2.5 },
                                    border: '1px solid #e8eaed',
                                    overflow: 'hidden',
                                    width: '100%',
                                }}
                            >
                                <Typography
                                    sx={{
                                        fontSize: { xs: '13px', sm: '14px', md: '15px' },
                                        fontWeight: 500,
                                        mb: 1.5,
                                        pb: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                        borderBottom: '1px solid #e8eaed',
                                        flexWrap: 'wrap',
                                    }}
                                >
                                    Цены для клиента
                                    <Box sx={{
                                        ml: { xs: 0, sm: 'auto' },
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 1,
                                    }}>
                                        <Button
                                            variant="contained"
                                            startIcon={calc.loading ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                                            onClick={calc.calculate}
                                            disabled={calc.loading}
                                            size="small"
                                            sx={{
                                                backgroundColor: '#1a73e8',
                                                borderRadius: '12px',
                                                padding: '4px 12px',
                                                fontWeight: 500,
                                                fontSize: '11px',
                                                textTransform: 'none',
                                                '&:hover': { backgroundColor: '#1557b0' },
                                            }}
                                        >
                                            Рассчитать
                                        </Button>
                                    </Box>
                                </Typography>

                                {calc.error && (
                                    <Alert severity="error" sx={{ mb: 2, fontSize: '13px' }}>
                                        {calc.error}
                                    </Alert>
                                )}

                                {calc.result ? (
                                    <Box sx={{
                                        '& .MuiTable-root': {
                                            fontSize: '12px',
                                            '& th': { fontSize: '10px', padding: '4px 6px' },
                                            '& td': { fontSize: '11px', padding: '4px 6px' }
                                        }
                                    }}>
                                        <PriceTable
                                            prices={calc.result.prices}
                                            branch={calc.result.branch}
                                            basePrice={Number(calc.result.basePrice)}
                                            onUpdatePriceList={calc.updatePriceList}
                                            onCalculate={calc.calculate}
                                            loading={calc.loading}
                                        />
                                    </Box>
                                ) : (
                                    <Typography sx={{ color: '#9aa0a6', fontSize: '13px', py: 2, textAlign: 'center' }}>
                                        Нажмите «Рассчитать» для получения цен
                                    </Typography>
                                )}

                                <Divider sx={{ my: 1.5 }} />
                            </Box>

                        </Paper>
                    </Container>
                </>
            )}
        </>
    );
}

export default App;
