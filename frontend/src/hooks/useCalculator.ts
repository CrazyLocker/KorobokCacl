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
    Operation,
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

// Standard operations fallback — used when /api/operations is unavailable
const STANDARD_EXTRAS: Extra[] = [
    { name: 'Лак', cost: 20, enabled: false },
    { name: 'Конгрев', cost: 30, enabled: false },
    { name: 'Тиснение', cost: 10, enabled: false },
    { name: 'Ламинация', cost: 0, enabled: false },
    { name: 'Шелкография', cost: 0, enabled: false },
];

// Map DB operations to calculator extras (fixed cost per detail)
const toExtras = (operations: Operation[]): Extra[] =>
    operations
        .filter((op) => op.isActive !== false)
        .map((op) => ({ name: op.name, cost: op.basePrice ?? 0, enabled: false }));

// "Индивидуальная" — все стандартные детали, но все enabled: false
const CUSTOM_CONSTRUCTION: Construct = {
    id: 'individual',
    name: 'Индивидуальная',
    description: 'Своя конфигурация',
    parts: { parts: [] },
    isActive: true,
};

export function useCalculator() {
    // --- Data from API ---
    const [constructs, setConstructs] = useState<Construct[]>([]);
    const [printTables, setPrintTables] = useState<PrintTable[]>([]);

    // --- Current state ---
    const [currentConstruction, setCurrentConstruction] = useState<string>('');
    const [details, setDetails] = useState<Detail[]>([]);
    const [extras, setExtras] = useState<Extra[]>(STANDARD_EXTRAS.map((e) => ({ ...e })));
    const [printSettings, setPrintSettings] = useState<PrintSettings>({
        enabled: true,
        format: 1,
        quantity: 100,
    });
    const [workPrice, setWorkPrice] = useState<number>(5);
    const [marginValue, setMarginValue] = useState<number>(30);
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

        // Operations from DB; fall back to built-in constants on failure
        calculatorApi
            .getOperations()
            .then((ops) => {
                if (ops && ops.length > 0) {
                    setExtras(toExtras(ops));
                }
            })
            .catch(() => {
                // keep STANDARD_EXTRAS
            });
    }, []);

    // --- Load construction ---
    const loadConstruction = useCallback(
        (name: string, constructsList?: Construct[]) => {
            const list = constructsList || constructs;
            // "Индивидуальная" — кастомная конструкция, нет в API
            const constr = name === CUSTOM_CONSTRUCTION.name
                ? CUSTOM_CONSTRUCTION
                : list.find((c) => c.name === name);
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
                    operations: {},
                };
            });

            // Preserve existing custom details (with their operations)
            const existingCustom = details.filter((d) => d.isCustom);
            setDetails([...baseDetails, ...existingCustom]);

            // Load price list for this construction (skip for "Индивидуальная")
            if (constr.id === CUSTOM_CONSTRUCTION.id) {
                setPriceList({});
            } else {
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
            }
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
                printSettings,
                workPrice,
                marginValue,
                priceList,
            };
            const response = await calculatorApi.calculate(request);
            setResult(response);
        } catch (err: any) {
            setError('Ошибка расчёта: ' + (err.response?.data?.message || err.message));
        } finally {
            setLoading(false);
        }
    }, [currentConstruction, details, extras, printSettings, workPrice, marginValue, priceList]);

    // --- Auto-recalculate on parameter changes (debounced 500ms) ---
    // Mirrors the HTML prototype's instant reactive behavior
    const calculateRef = useCallback(() => {
        if (currentConstruction) {
            calculate();
        }
    }, [calculate, currentConstruction]);

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            calculateRef();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [calculateRef]);

    // --- Detail operations ---
    const updateDetail = useCallback((index: number, field: keyof Detail, value: any) => {
        setDetails((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    }, []);

    const updateDetailOperation = useCallback((detailIndex: number, opName: string, value: boolean) => {
        setDetails((prev) => {
            const next = [...prev];
            next[detailIndex] = {
                ...next[detailIndex],
                operations: { ...next[detailIndex].operations, [opName]: value },
            };
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
                operations: {},
            },
        ]);
    }, []);

    const removeCustomDetail = useCallback((index: number) => {
        setDetails((prev) => prev.filter((_, i) => i !== index));
    }, []);

    // --- Extra operations (unified: standard + custom) ---
    const updateExtra = useCallback((index: number, field: keyof Extra, value: any) => {
        setExtras((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    }, []);

    const addCustomExtra = useCallback(() => {
        setExtras((prev) => [
            ...prev,
            { name: 'Операция ' + (prev.length + 1), cost: 0, enabled: true, isCustom: true },
        ]);
    }, []);

    const removeCustomExtra = useCallback((index: number) => {
        setExtras((prev) => {
            const removed = prev[index];
            const next = prev.filter((_, i) => i !== index);
            // Remove this operation from all details' operations maps
            if (removed) {
                setDetails((dPrev) =>
                    dPrev.map((d) => {
                        const ops = { ...d.operations };
                        delete ops[removed.name];
                        return { ...d, operations: ops };
                    }),
                );
            }
            return next;
        });
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
        printSettings,
        workPrice,
        marginValue,
        priceList,
        result,
        loading,
        error,
        tierLabels: TIER_LABELS,
        individualConstruction: CUSTOM_CONSTRUCTION,
        // actions
        loadConstruction,
        calculate: calculateRef,
        updateDetail,
        updateDetailOperation,
        addCustomDetail,
        removeCustomDetail,
        updateExtra,
        addCustomExtra,
        removeCustomExtra,
        updatePriceList,
        updatePrintSettings,
        setWorkPrice,
        setMarginValue,
    };
}
