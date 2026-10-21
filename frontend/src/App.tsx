// frontend/src/App.tsx
import { useState, useCallback, useEffect } from 'react';
import { App as AntdApp } from 'antd';
import { Paper, Box, Typography, Alert, CircularProgress, CssBaseline, ThemeProvider } from '@mui/material';
import { AppShell } from './components/Layout/AppShell';
import { CalculatorPage } from './components/Calculator/CalculatorPage';
import { SaveCalculationModal } from './components/Calculator/SaveCalculationModal';
import { useCalculator } from './hooks/useCalculator';
import { ReferencesPage } from './components/References/ReferencesPage';
import { SettingsPage } from './components/Settings/SettingsPage';
import { DevStub } from './components/DevStub';
import { LayoutPage } from './features/layout/ui/LayoutPage';
import { calculatorApi } from './api/calculatorApi';
import { PAGE_PATHS, pageFromPath } from './navigation';
import type { PageType } from './navigation';
import { theme } from './theme';

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
    const { message } = AntdApp.useApp();
    const [activePage, setActivePage] = useState<PageType>(() => pageFromPath(window.location.pathname));
    const [saveDialogOpen, setSaveDialogOpen] = useState(false);

    // Keep the page and the address bar in sync, including browser back/forward.
    useEffect(() => {
        const handlePopState = () => setActivePage(pageFromPath(window.location.pathname));
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    const navigateToPage = useCallback((page: PageType) => {
        setActivePage(page);
        const path = PAGE_PATHS[page];
        if (window.location.pathname !== path) {
            window.history.pushState({}, '', path);
        }
    }, []);

    // Все уведомления идут через Ant Design App context: тема и ru_RU применяются.
    const handleNotify = useCallback((
        text: string,
        severity: 'success' | 'error' | 'info' = 'info',
    ) => {
        const notify = severity === 'success'
            ? message.success
            : severity === 'error'
                ? message.error
                : message.info;
        notify(text);
    }, [message]);

    const renderPage = () => {
        switch (activePage) {
            case 'calculator':
                return <CalculatorPage calc={calc} />;

            case 'layout':
                // The calculator state lives here, so the layout page receives a
                // callback instead of reaching into another page's hook.
                return <LayoutPage onTransferToCalculator={calc.applyLayoutCounts} />;

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
        <ThemeProvider theme={theme}>
            <CssBaseline />
            <AppShell
                activePage={activePage}
                onNavigate={navigateToPage}
                onSave={() => setSaveDialogOpen(true)}
            >
                {renderPage()}
            </AppShell>
            <SaveCalculationModal
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
        </ThemeProvider>
    );
}

export default App;
