// frontend/src/hooks/useCalculator.ts
import { useState, useCallback, useEffect } from 'react';
import { calculatorApi } from '../api/calculatorApi';
import type {
    Detail,
    Extra,
    PrintSettings,
    CalculationResponse,
    Construct,
    PrintTable,
} from '../types';

const DEFAULT_PART_NAMES = [
    'Дно',
    'Дно+Разделитель',
    'Крышка',
    'Крышка с окном',
    'Разделитель',
    'Дно-лайнер',
    'Крышка-лайнер',
    'Шубер',
];

const TIER_LABELS = ['до 9', '10–49', '50–199', '200–499', '500–699', '700–1499', 'от 1500'];

export function useCalculator() {
    // --- Data from API ---
    const [constructs, setConstructs] = useState<Construct[]>([]);
    const [printTables, setPrintTables] = useState<PrintTable[]>([]);

    // --- Current state ---
    const [currentConstruction, setCurrentConstruction] = useState<string>('');
    const [details, setDetails] = useState<Detail[]>([]);
    const [extras, setExtras] = useState<Extra[]>([
        { name: 'Лак', cost: 20, enabled: false },
        { name: 'Конгрев', cost: 30, enabled: false },
        { name: 'Тиснение', cost: 10, enabled: false },
    ]);
    const [customExtras, setCustomExtras] = useState<Extra[]>([]);
    const [printSettings, setPrintSettings] = useState<PrintSettings>({
        enabled: false,
        format: 1,
        quantity: 100,
    });
    const [workPrice, setWorkPrice] = useState<number>(5);
    const [priceList, setPriceList] = useState<Record<string, number>>({});
    const [result, setResult] = useState<CalculationResponse | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // --- Load initial data ---
    useEffect(() => {
        Promise.all([calculatorApi.getConstructs(), calculatorApi.getPrintTables()])
            .then(([c, pt]) => {
                setConstructs(c);
                setPrintTables(pt);
                if (c.length > 0) {
                    loadConstruction(c[0].name, c);
                }
            })
            .catch((err) => setError('Ошибка загрузки данных: ' + err.message));
    }, []);

    // --- Load construction ---
    const loadConstruction = useCallback(
        (name: string, constructsList?: Construct[]) => {
            const list = constructsList || constructs;
            const constr = list.find((c) => c.name === name);
            if (!constr) return;

            setCurrentConstruction(name);

            // Build details from construction parts
            const partsData = constr.parts?.parts || [];
            const baseDetails: Detail[] = DEFAULT_PART_NAMES.map((partName) => {
                const part = partsData.find((p) => p.name === partName);
                const countOnSheet = part ? part.perSheet : 0;
                return {
                    name: partName,
                    countOnSheet,
                    sheetPrice: 35,
                    isPrinted: false,
                    isCustom: false,
                    enabled: countOnSheet > 0,
                    hasLak: false,
                    hasCongrev: false,
                    hasTisnenie: false,
                };
            });

            // Preserve existing custom details
            const existingCustom = details.filter((d) => d.isCustom);
            setDetails([...baseDetails, ...existingCustom]);

            // Load price list for this construction
            calculatorApi
                .getPriceList(constr.id)
                .then((pl) => {
                    if (pl && pl.priceData) {
                        setPriceList(pl.priceData);
                    } else {
                        setPriceList({});
                    }
                })
                .catch(() => setPriceList({}));
        },
        [constructs, details],
    );

    // --- Calculate ---
    const calculate = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const request = {
                construction: currentConstruction,
                details,
                extras,
                customExtras,
                printSettings,
                workPrice,
                priceList,
            };
            const response = await calculatorApi.calculate(request);
            setResult(response);
        } catch (err: any) {
            setError('Ошибка расчёта: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    }, [currentConstruction, details, extras, customExtras, printSettings, workPrice, priceList]);

    // --- Detail operations ---
    const updateDetail = useCallback((index: number, field: keyof Detail, value: any) => {
        setDetails((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    }, []);

    const addCustomDetail = useCallback(() => {
        setDetails((prev) => [
            ...prev,
            {
                name: 'Деталь ' + (prev.length + 1),
                countOnSheet: 1,
                sheetPrice: 35,
                isPrinted: false,
                isCustom: true,
                enabled: true,
                hasLak: false,
                hasCongrev: false,
                hasTisnenie: false,
            },
        ]);
    }, []);

    const removeCustomDetail = useCallback((index: number) => {
        setDetails((prev) => prev.filter((_, i) => i !== index));
    }, []);

    // --- Extra operations ---
    const updateExtra = useCallback((index: number, field: keyof Extra, value: any) => {
        setExtras((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    }, []);

    const updateCustomExtra = useCallback((index: number, field: keyof Extra, value: any) => {
        setCustomExtras((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    }, []);

    const addCustomExtra = useCallback(() => {
        setCustomExtras((prev) => [
            ...prev,
            { name: 'Операция ' + (prev.length + 1), cost: 0, enabled: true, isCustom: true },
        ]);
    }, []);

    const removeCustomExtra = useCallback((index: number) => {
        setCustomExtras((prev) => prev.filter((_, i) => i !== index));
    }, []);

    // --- Price list ---
    const updatePriceList = useCallback((label: string, value: number) => {
        setPriceList((prev) => ({ ...prev, [label]: value }));
    }, []);

    // --- Print settings ---
    const updatePrintSettings = useCallback((field: keyof PrintSettings, value: any) => {
        setPrintSettings((prev) => ({ ...prev, [field]: value }));
    }, []);

    return {
        // data
        constructs,
        printTables,
        currentConstruction,
        details,
        extras,
        customExtras,
        printSettings,
        workPrice,
        priceList,
        result,
        loading,
        error,
        tierLabels: TIER_LABELS,
        // actions
        loadConstruction,
        calculate,
        updateDetail,
        addCustomDetail,
        removeCustomDetail,
        updateExtra,
        updateCustomExtra,
        addCustomExtra,
        removeCustomExtra,
        updatePriceList,
        updatePrintSettings,
        setWorkPrice,
    };
}
