// frontend/src/App.tsx
import { useState, useCallback } from 'react';
import { Paper, Box, Typography, Button, Divider, Alert, ToggleButton, ToggleButtonGroup, Snackbar, Alert as MuiAlert, CircularProgress } from '@mui/material';
import { Sidebar } from './components/Layout/Sidebar';
import { ConstructionSelector } from './components/Calculator/ConstructionSelector';
import { LayoutTable } from './components/Calculator/LayoutTable';
import { ExtrasBlock } from './components/Calculator/ExtrasBlock';
import { PriceTable } from './components/Calculator/PriceTable';
import { SaveCalculationDialog } from './components/Calculator/SaveCalculationDialog';
import { useCalculator } from './hooks/useCalculator';
import { NewApp } from './components/NewApp';
import { ReferencesPage } from './components/References/ReferencesPage';
import { SettingsPage } from './components/Settings/SettingsPage';
import { DevStub } from './components/DevStub';
import { calculatorApi } from './api/calculatorApi';
import './App.css';

type PageType = 'calculator' | 'knife' | 'cliche' | 'congrev' | 'silkscreen' | 'references' | 'settings';

// Результат расчёта ножа (ответ /api/knife/calculate)
interface KnifeResult {
    totalLengthPx: number;
    totalLengthMm: number;
    knifeCost: number;
    scale: number;
    details: { type: string; lengthPx: number; lengthMm: number }[];
}

/**
 * Страница "Расчет ножа": загрузка SVG → длина линий в мм → стоимость (длина × 3 + 500).
 */
const KnifePage = () => {
    const [fileName, setFileName] = useState<string>('');
    const [result, setResult] = useState<KnifeResult | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFile = async (file: File) => {
        setFileName(file.name);
        setResult(null);
        setError(null);
        setLoading(true);
        try {
            const svgContent = await file.text();
            const res = await calculatorApi.calculateKnife(svgContent);
            setResult(res);
        } catch (err: any) {
            setError('Ошибка расчёта ножа: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2, md: 3, lg: 4 }, borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
            <Typography variant="h5" sx={{ fontWeight: 600, color: '#202124', mb: 2, textAlign: 'left' }}>
                Расчет ножа
            </Typography>
            <Typography sx={{ fontSize: '13px', color: '#5f6368', mb: 2, textAlign: 'left' }}>
                Загрузите SVG-файл развёртки. Стоимость = длина линий (мм) × 3 + 500 ₽.
            </Typography>

            <Box
                sx={{
                    border: '2px dashed #1a73e8',
                    borderRadius: '12px',
                    p: 4,
                    textAlign: 'center',
                    backgroundColor: '#f8f9fa',
                    cursor: 'pointer',
                    '&:hover': { backgroundColor: '#e8f0fe' },
                }}
                onClick={() => document.getElementById('knife-file-input')?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                    e.preventDefault();
                    const file = e.dataTransfer.files?.[0];
                    if (file) handleFile(file);
                }}
            >
                <input
                    id="knife-file-input"
                    type="file"
                    accept=".svg,image/svg+xml"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleFile(file);
                    }}
                />
                <Typography sx={{ fontSize: '14px', color: '#1a73e8', fontWeight: 500 }}>
                    {fileName ? `Файл: ${fileName}` : 'Выберите или перетащите SVG-файл'}
                </Typography>
                {loading && <CircularProgress size={20} sx={{ mt: 1 }} />}
            </Box>

            {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

            {result && (
                <Box sx={{ mt: 3 }}>
                    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', mb: 2 }}>
                        <Box sx={{ flex: 1, minWidth: 180, p: 2, backgroundColor: '#e8f0fe', borderRadius: '12px' }}>
                            <Typography sx={{ fontSize: '12px', color: '#5f6368' }}>Длина линий</Typography>
                            <Typography sx={{ fontSize: '22px', fontWeight: 700, color: '#1a73e8' }}>
                                {result.totalLengthMm.toFixed(2)} мм
                            </Typography>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 180, p: 2, backgroundColor: '#e6f4ea', borderRadius: '12px' }}>
                            <Typography sx={{ fontSize: '12px', color: '#5f6368' }}>Стоимость ножа</Typography>
                            <Typography sx={{ fontSize: '22px', fontWeight: 700, color: '#137333' }}>
                                {result.knifeCost.toFixed(2)} ₽
                            </Typography>
                        </Box>
                        <Box sx={{ flex: 1, minWidth: 180, p: 2, backgroundColor: '#f8f9fa', borderRadius: '12px' }}>
                            <Typography sx={{ fontSize: '12px', color: '#5f6368' }}>Масштаб (мм/ед. SVG)</Typography>
                            <Typography sx={{ fontSize: '22px', fontWeight: 700, color: '#202124' }}>
                                {result.scale.toFixed(4)}
                            </Typography>
                        </Box>
                    </Box>

                    {result.details.length > 0 && (
                        <>
                            <Typography sx={{ fontSize: '13px', fontWeight: 500, color: '#5f6368', mb: 1, textAlign: 'left' }}>
                                Элементы:
                            </Typography>
                            <Box sx={{ maxHeight: 300, overflow: 'auto', border: '1px solid #e8eaed', borderRadius: '8px' }}>
                                {result.details.map((d, i) => (
                                    <Box key={i} sx={{ display: 'flex', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid #f1f3f4' }}>
                                        <Typography sx={{ fontSize: '13px' }}>{d.type}</Typography>
                                        <Typography sx={{ fontSize: '13px', color: '#5f6368' }}>
                                            {d.lengthMm.toFixed(2)} мм
                                        </Typography>
                                    </Box>
                                ))}
                            </Box>
                        </>
                    )}
                </Box>
            )}
        </Paper>
    );
};

function App() {
    const calc = useCalculator();
    const [view, setView] = useState<'classic' | 'new'>('classic');
    const [activePage, setActivePage] = useState<PageType>('calculator');
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);
    const [notification, setNotification] = useState<{ open: boolean; message: string; severity: 'success' | 'error' | 'info' }>({
        open: false,
        message: '',
        severity: 'info',
    });

    const handleViewChange = (_: React.MouseEvent<HTMLElement>, newView: 'classic' | 'new') => {
        if (newView !== null) setView(newView);
    };

    // Стоимость печати за единицу (как в HTML-прототипе calcPrintPerUnitNoVat).
    // Локальный расчёт по таблице печати: шаг по тиражу + надбавка после 3000.
    const printPerUnit = (() => {
        if (!calc.printSettings.enabled) return 0;
        const table = calc.printTables.find((t) => t.formatId === calc.printSettings.format);
        if (!table || calc.printSettings.quantity <= 0) return 0;
        const step = table.steps.find((s) => s.minQty >= calc.printSettings.quantity);
        let cost = step?.price || table.steps[0]?.price || 0;
        if (calc.printSettings.quantity >= 3000) {
            const lastStep = table.steps[table.steps.length - 1];
            const extra = Math.ceil((calc.printSettings.quantity - 3000) / 1000) * table.stepAfter3000;
            cost = lastStep.price + extra;
        }
        return cost / calc.printSettings.quantity;
    })();

    const handleNotify = useCallback((message: string, severity: 'success' | 'error' | 'info' = 'info') => {
        setNotification({ open: true, message, severity });
    }, []);

    const handleCloseNotification = () => {
        setNotification((prev) => ({ ...prev, open: false }));
    };

    const renderPage = () => {
        switch (activePage) {
            case 'calculator':
                return view === 'new' ? <NewApp /> : (
                    <>
                        <Typography
                            variant="h4"
                            sx={{
                                px: { xs: 1, sm: 1.5, md: 2, lg: 3 },
                                pt: 1.5,
                                pb: 0.5,
                                fontSize: { xs: '18px', sm: '20px', md: '24px', lg: '28px' },
                                fontWeight: 600,
                                color: '#202124',
                                textAlign: 'left',
                            }}
                        >
                            Расчет стоимости заказа коробки
                        </Typography>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 2, px: { xs: 1, sm: 1.5, md: 2, lg: 3 }, pt: 1.5 }}>
                            <Button
                                variant="outlined"
                                size="small"
                                onClick={() => setSaveDialogOpen(true)}
                                sx={{ textTransform: 'none', fontSize: '12px', borderRadius: '20px', borderColor: '#1a73e8', color: '#1a73e8' }}
                            >
                                Сохранить расчёт
                            </Button>
                            <ToggleButtonGroup value={view} exclusive onChange={handleViewChange} size="small" sx={{ backgroundColor: '#f8f9fa', borderRadius: '20px', border: '1px solid #e8eaed' }}>
                                <ToggleButton value="classic" sx={{ fontSize: '12px', textTransform: 'none', px: 2, py: 0.5, borderRadius: '20px', '&.Mui-selected': { backgroundColor: '#1a73e8', color: '#fff', '&:hover': { backgroundColor: '#1557b0' } } }}>
                                    Классический
                                </ToggleButton>
                                <ToggleButton value="new" sx={{ fontSize: '12px', textTransform: 'none', px: 2, py: 0.5, borderRadius: '20px', '&.Mui-selected': { backgroundColor: '#1a73e8', color: '#fff', '&:hover': { backgroundColor: '#1557b0' } } }}>
                                    Новый UI
                                </ToggleButton>
                            </ToggleButtonGroup>
                        </Box>
                        <Box sx={{ mt: { xs: 1.5, sm: 2, md: 3 }, px: { xs: 1, sm: 1.5, md: 2, lg: 3 }, width: '100%', maxWidth: { xs: '100%', sm: '100%', md: '130%', lg: '150%', xl: '2400px' }, mx: 'auto' }}>
                            <Paper elevation={0} sx={{ p: { xs: 1.5, sm: 2, md: 3, lg: 4 }, borderRadius: { xs: '8px', sm: '10px', md: '12px' }, boxShadow: '0 2px 8px rgba(0,0,0,0.12)' }}>
                                {/* === РАСКЛАДКА (на всю ширину) === */}
                                <Box sx={{ backgroundColor: '#f8f9fa', borderRadius: { xs: '8px', sm: '10px', md: '12px' }, p: { xs: 1.5, sm: 2, md: 3 }, mb: 3, border: '1px solid #e8eaed' }}>
                                    <Typography sx={{ fontSize: { xs: '13px', sm: '14px', md: '14px' }, fontWeight: 500, color: '#5f6368', textTransform: 'uppercase', letterSpacing: '0.05em', mb: 1.5, display: 'flex', alignItems: 'center', gap: 1, textAlign: 'left' }}>
                                        Раскладка на лист 100×70
                                    </Typography>
                                    <ConstructionSelector constructs={calc.constructs} value={calc.currentConstruction} onChange={(name) => calc.loadConstruction(name)} additionalConstruct={calc.individualConstruction} />
                                    <LayoutTable details={calc.details} extras={calc.extras} onUpdateDetail={calc.updateDetail} onUpdateDetailOperation={calc.updateDetailOperation} onAddCustomDetail={calc.addCustomDetail} onRemoveCustomDetail={calc.removeCustomDetail} />
                                </Box>

                                {/* === ДВА СТОЛБЦА === */}
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: { xs: 2, sm: 2.5, md: 3 }, minWidth: 0 }}>
                                    {/* Левый столбец: Детали + Дополнительные операции */}
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2.5, md: 3 } }}>
                                        {/* Детали */}
                                        <Box sx={{ backgroundColor: '#f8f9fa', borderRadius: { xs: '8px', sm: '10px', md: '12px' }, p: { xs: 1.5, sm: 2, md: 2.5 }, border: '1px solid #e8eaed', overflow: 'hidden', flex: 1 }}>
                                            <Typography sx={{ fontSize: { xs: '13px', sm: '14px', md: '14px' }, fontWeight: 500, mb: 1.5, pb: 1, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #e8eaed', flexWrap: 'wrap', textAlign: 'left' }}>
                                                Детали
                                                <Box sx={{ ml: { xs: 0, sm: 'auto' }, backgroundColor: '#1a73e8', color: '#fff', fontSize: { xs: '9px', sm: '10px' }, fontWeight: 500, px: 1.5, py: 0.25, borderRadius: '16px', whiteSpace: 'nowrap' }}>
                                                    материал + работа{printPerUnit > 0 ? ' + печать' : ''}
                                                </Box>
                                            </Typography>
                                            {calc.details.filter((d) => d.enabled && d.countOnSheet > 0).length === 0 ? (
                                                <Typography sx={{ color: '#9aa0a6', fontSize: '13px', py: 1, textAlign: 'left' }}>
                                                    Нет активных деталей для выбранной конструкции
                                                </Typography>
                                            ) : (
                                                calc.details.filter((d) => d.enabled && d.countOnSheet > 0).map((d, i) => {
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
                                                    // Печать добавляется к каждой детали с isPrinted (как в HTML-прототипе)
                                                    const printCost = d.isPrinted ? printPerUnit : 0;
                                                    const finalCost = costPrice + extraCost + printCost;
                                                    return (
                                                        <Box key={i} sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, py: 0.75, borderBottom: '1px solid #e8eaed', gap: { xs: 0.5, sm: 0 } }}>
                                                            <Typography sx={{ fontSize: { xs: '12px', sm: '13px' }, display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'wrap', whiteSpace: 'nowrap' }}>
                                                                {d.name}
                                                                <Box component="span" sx={{ fontSize: { xs: '9px', sm: '10px', md: '11px' }, color: '#9aa0a6', whiteSpace: 'nowrap' }}>
                                                                    ({d.sheetPrice}/{d.countOnSheet}={materialCost.toFixed(2)}+{calc.workPrice}{printCost > 0 ? `+печать${printCost.toFixed(2)}` : ''}{extraCost > 0 ? `+${labels.join('+')}${extraCost.toFixed(2)}` : ''})
                                                                </Box>
                                                            </Typography>
                                                            <Typography sx={{ fontSize: { xs: '12px', sm: '13px', md: '14px' }, fontWeight: 500, backgroundColor: '#fff', px: { xs: 1.5, sm: 2 }, py: 0.25, borderRadius: '20px', boxShadow: '0 1px 2px rgba(0,0,0,0.06)', alignSelf: { xs: 'flex-end', sm: 'auto' }, whiteSpace: 'nowrap' }}>
                                                                {finalCost.toFixed(2)} <Box component="span" sx={{ fontSize: { xs: '9px', sm: '10px', md: '11px' }, fontWeight: 400, color: '#9aa0a6' }}>руб.</Box>
                                                            </Typography>
                                                        </Box>
                                                    );
                                                })
                                            )}
                                            <Box sx={{ mt: 1.5, p: { xs: 1, sm: 1.5 }, backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e8eaed', display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, flexWrap: 'wrap' }}>
                                                <Typography sx={{ fontWeight: 500, fontSize: { xs: '12px', sm: '13px' }, display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}>
                                                    Работа
                                                </Typography>
                                                <input type="number" value={calc.workPrice} step={0.5} min={0} onChange={(e) => calc.setWorkPrice(parseFloat(e.target.value) || 0)} style={{ width: 60, padding: '4px 6px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '12px', textAlign: 'center', fontFamily: 'inherit' }} />
                                                <Typography sx={{ color: '#5f6368', fontSize: { xs: '10px', sm: '11px' }, whiteSpace: 'nowrap' }}>руб./деталь</Typography>
                                                <Box component="span" sx={{ width: 1, height: 20, backgroundColor: '#e8eaed', mx: 0.5 }} />
                                                <Typography sx={{ fontWeight: 500, fontSize: { xs: '12px', sm: '13px' }, display: 'flex', alignItems: 'center', gap: 0.5, whiteSpace: 'nowrap' }}>
                                                    Плечо
                                                </Typography>
                                                <input type="number" value={calc.marginValue} step={1} min={0} onChange={(e) => calc.setMarginValue(parseFloat(e.target.value) || 0)} style={{ width: 60, padding: '4px 6px', border: '1px solid #dadce0', borderRadius: '6px', fontSize: '12px', textAlign: 'center', fontFamily: 'inherit' }} />
                                                <Typography sx={{ color: '#5f6368', fontSize: { xs: '10px', sm: '11px' }, whiteSpace: 'nowrap' }}>
                                                    → ветка +{calc.marginValue}
                                                </Typography>
                                            </Box>
                                        </Box>

                                        {/* Дополнительные операции */}
                                        <Box sx={{ backgroundColor: '#f8f9fa', borderRadius: { xs: '8px', sm: '10px', md: '12px' }, p: { xs: 1.5, sm: 2, md: 2.5 }, border: '1px solid #e8eaed', overflow: 'hidden' }}>
                                            <Typography sx={{ fontSize: { xs: '13px', sm: '14px', md: '14px' }, fontWeight: 500, mb: 1.5, pb: 1, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #e8eaed', textAlign: 'left' }}>
                                                Дополнительные операции
                                            </Typography>
                                            <ExtrasBlock extras={calc.extras} printSettings={calc.printSettings} printTables={calc.printTables} onUpdateExtra={calc.updateExtra} onAddCustomExtra={calc.addCustomExtra} onRemoveCustomExtra={calc.removeCustomExtra} onUpdatePrintSettings={calc.updatePrintSettings} />
                                        </Box>
                                    </Box>

                                    {/* Правый столбец: Цены для клиента */}
                                    <Box sx={{ backgroundColor: '#f8f9fa', borderRadius: { xs: '8px', sm: '10px', md: '12px' }, p: { xs: 1.5, sm: 2, md: 2.5 }, border: '1px solid #e8eaed', overflow: 'hidden', flex: 1 }}>
                                        <Typography sx={{ fontSize: { xs: '13px', sm: '14px', md: '14px' }, fontWeight: 500, mb: 1.5, pb: 1, display: 'flex', alignItems: 'center', gap: 1, borderBottom: '1px solid #e8eaed', flexWrap: 'wrap', textAlign: 'left' }}>
                                            Цена коробки
                                        </Typography>
                                        {calc.error && <Alert severity="error" sx={{ mb: 2, fontSize: '13px' }}>{calc.error}</Alert>}
                                        {calc.result ? (
                                            <>
                                                <Box sx={{ '& .MuiTable-root': { fontSize: '12px', '& th': { fontSize: '10px', padding: '4px 6px' }, '& td': { fontSize: '11px', padding: '4px 6px' } } }}>
                                                    <PriceTable prices={calc.result.prices} branch={calc.result.branch} basePrice={Number(calc.result.basePrice)} onUpdatePriceList={calc.updatePriceList} loading={calc.loading} />
                                                </Box>
                                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 1.5, pt: 1.5, borderTop: '1px solid #e8eaed' }}>
                                                    <Typography sx={{ fontSize: '13px', fontWeight: 600, color: '#202124', textAlign: 'left' }}>
                                                        Себестоимость коробки
                                                    </Typography>
                                                    <Typography sx={{ fontSize: '14px', fontWeight: 700, color: '#1a73e8', textAlign: 'left' }}>
                                                        {calc.result.totalCost.toFixed(2)} руб.
                                                    </Typography>
                                                </Box>
                                            </>
                                        ) : (
                                            <Typography sx={{ color: '#9aa0a6', fontSize: '13px', py: 2, textAlign: 'left' }}>
                                                Цены рассчитываются автоматически
                                            </Typography>
                                        )}
                                        <Divider sx={{ my: 1.5 }} />
                                    </Box>
                                </Box>
                            </Paper>
                        </Box>
                    </>
                );

            case 'knife':
                return <KnifePage />;

            case 'references':
                return <ReferencesPage onNotify={handleNotify} />;

            case 'cliche':
            case 'congrev':
            case 'silkscreen':
                return (
                    <Box sx={{ p: 4 }}>
                        <DevStub title={
                            activePage === 'cliche' ? 'Расчет клише' :
                            activePage === 'congrev' ? 'Расчет конгрев' :
                            'Расчет шелкография'
                        } />
                    </Box>
                );

            case 'settings':
                return <SettingsPage onNotify={handleNotify} />;

            default:
                return null;
        }
    };

    return (
        <>
            <Box sx={{ display: 'flex', gap: 2.5, p: { xs: 1, sm: 2, md: 3 } }}>
                <Sidebar activePage={activePage} onNavigate={setActivePage} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {renderPage()}
                </Box>
            </Box>
            <SaveCalculationDialog
                open={saveDialogOpen}
                onClose={() => setSaveDialogOpen(false)}
                onNotify={handleNotify}
                calculation={{
                    construction: calc.currentConstruction,
                    details: calc.details,
                    extras: calc.extras,
                    printSettings: calc.printSettings,
                    workPrice: calc.workPrice,
                    marginValue: calc.marginValue,
                    priceList: calc.priceList,
                }}
            />
            <Snackbar open={notification.open} autoHideDuration={3000} onClose={handleCloseNotification} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
                <MuiAlert onClose={handleCloseNotification} severity={notification.severity} sx={{ width: '100%' }}>
                    {notification.message}
                </MuiAlert>
            </Snackbar>
        </>
    );
}

export default App;
