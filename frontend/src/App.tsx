// frontend/src/App.tsx
import { useState, useCallback, useEffect, useRef } from 'react';
import { App as AntdApp } from 'antd';
import { AppShell } from './components/Layout/AppShell';
import { CalculatorPage } from './components/Calculator/CalculatorPage';
import { SaveCalculationModal } from './components/Calculator/SaveCalculationModal';
import { useCalculator } from './hooks/useCalculator';
import { ReferencesPage } from './components/References/ReferencesPage';
import { SettingsPage } from './components/Settings/SettingsPage';
import { DevStub } from './components/DevStub';
import { LayoutPage } from './features/layout/ui/LayoutPage';
import { KnifePage } from './features/knife/ui/KnifePage';
import { PAGE_PATHS, pageFromPath } from './navigation';
import type { PageType } from './navigation';

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

    // Re-read the reference book whenever the calculator page is opened again,
    // so constructions edited in Справочники are visible without F5.
    // The latest callback lives in a ref and the effect depends on activePage only:
    // reloadConstructs changes identity with every constructs update, so a direct
    // dependency would re-fire the effect and reload in a loop.
    const reloadConstructsRef = useRef(calc.reloadConstructs);
    useEffect(() => {
        reloadConstructsRef.current = calc.reloadConstructs;
    });

    // useCalculator already fetches the constructs on mount, so only a real
    // transition into the page reloads them (previous === null means first run).
    const previousPage = useRef<PageType | null>(null);
    useEffect(() => {
        const previous = previousPage.current;
        previousPage.current = activePage;
        if (activePage === 'calculator' && previous !== null && previous !== 'calculator') {
            reloadConstructsRef.current();
        }
    }, [activePage]);

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
                return <DevStub title={
                    activePage === 'cliche' ? 'Расчет клише' :
                    activePage === 'congrev' ? 'Расчет конгрев' :
                    'Расчет шелкография'
                } />;

            case 'settings':
                return <SettingsPage onNotify={handleNotify} />;

            default:
                return null;
        }
    };

    return (
        <>
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
                    assemblySettings: calc.assemblySettings,
                    workPrice: calc.workPrice,
                    marginValue: calc.marginValue,
                    priceList: calc.priceList,
                }}
            />
        </>
    );
}

export default App;
