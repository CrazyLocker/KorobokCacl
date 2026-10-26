// frontend/src/hooks/useCalculator.ts
import { useState, useCallback, useEffect } from 'react';
import { calculatorApi } from '../api/calculatorApi';
import { createDetailUiKey, toApiDetails } from '../utils/calculationRequest';
import { sortConstructs } from '../utils/sortConstructs';
import { sortParts } from '../utils/sortParts';
import type {
    Detail,
    Extra,
    PrintSettings,
    CalculationResponse,
    Construct,
    PrintTable,
    Operation,
} from '../types';

const TIER_LABELS = ['до 9', '10–49', '50–199', '200–499', '500–699', '700–1499', 'от 1500'];

// Standard operations fallback — used when /api/operations is unavailable
const STANDARD_EXTRAS: Extra[] = [
    { name: 'Лак', cost: 20, enabled: false },
    { name: 'Конгрев', cost: 30, enabled: false },
    { name: 'Тиснение', cost: 10, enabled: false },
    { name: 'Ламинация', cost: 0, enabled: false },
    { name: 'Шелкография', cost: 0, enabled: false },
];

/** One row passed from the layout page: a detail name and how many fit per sheet. */
export interface LayoutCount {
    name: string;
    placed: number;
}

/** What applyLayoutCounts changed in the calculator. */
export interface LayoutCountsReport {
    updated: string[];
    added: string[];
}

/** Prototype normDetailName: case, ё and whitespace insensitive. */
const normalizeDetailName = (name: string): string =>
    name.trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');

// Map DB operations to calculator extras (fixed cost per detail)
const toExtras = (operations: Operation[]): Extra[] =>
    operations
        .filter((op) => op.isActive !== false)
        .map((op) => ({ name: op.name, cost: op.basePrice ?? 0, enabled: false }));

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
                // Порядок из API произвольный: в UI конструкции идут по классу и размеру.
                const sortedConstructs = sortConstructs(c);
                setConstructs(sortedConstructs);
                setPrintTables(pt);
                if (sortedConstructs.length > 0) {
                    loadConstruction(sortedConstructs[0].name, sortedConstructs);
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
            const constr = list.find((c) => c.name === name);
            if (!constr) return;

            setCurrentConstruction(name);

            // Details are built from the construction itself: the reference book is
            // the single source of truth. A part deleted there disappears here after
            // reload, and a part with perSheet = 0 stays visible but disabled.
            // The sheet price always comes from the part itself: the cardboard
            // kind is not part of the model, the calculator knows only the price.
            // Порядок деталей — единый для всего UI (sortParts), а не порядок из API.
            const partsData = sortParts(constr.parts || []);
            const constructionDetails: Detail[] = partsData.map((part) => ({
                uiKey: createDetailUiKey(),
                name: part.name,
                countOnSheet: part.perSheet,
                sheetPrice: part.pricePerSheet ?? 0,
                isPrinted: false,
                partsPerSheetOnPrint: 1,
                isCustom: false,
                enabled: part.perSheet > 0,
                operations: {},
            }));

            // No fallback list and no carry-over of rows from the previous
            // construction: an empty parts list means an empty calculator.
            setDetails(constructionDetails);

            // Load the price list of this construction. A construction without a
            // price list is normal: the table stays empty until prices are filled in.
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
        [constructs],
    );

    // --- Reload constructs (edited on another page) ---
    // The reference book is the source of truth, so when the calculator page is
    // opened again the constructions must be re-read instead of waiting for F5.
    // When nothing changed, the calculator state is kept as is: reloading the
    // current construction rebuilds its details and would throw away the layout
    // transfer and any in-session edits.
    const reloadConstructs = useCallback(async () => {
        try {
            // Список в state всегда отсортирован — сравнение с ним остаётся корректным.
            const list = sortConstructs(await calculatorApi.getConstructs());
            const isUnchanged = JSON.stringify(list) === JSON.stringify(constructs);
            setConstructs(list);
            if (isUnchanged) return;

            const current = list.find((c) => c.name === currentConstruction);
            if (current) {
                loadConstruction(current.name, list);
            } else if (list.length > 0) {
                loadConstruction(list[0].name, list);
            } else {
                setDetails([]);
            }
        } catch (err) {
            const reason = err instanceof Error ? err.message : String(err);
            setError('Ошибка загрузки данных: ' + reason);
        }
    }, [constructs, currentConstruction, loadConstruction]);

    // --- Calculate ---
    const calculate = useCallback(async () => {
        // Backend rejects an empty detail list (@NotEmpty on CalculationRequest.details).
        // An empty construction is a normal state: the page shows a hint instead of
        // a red "Ошибка расчёта", so skip the request and drop stale prices.
        if (details.length === 0) {
            setResult(null);
            setError(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const request = {
                construction: currentConstruction,
                details: toApiDetails(details),
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
    // Details are addressed by their client-side uiKey, never by row index:
    // adding/removing a row must not redirect an edit to another detail.
    const updateDetail = useCallback((uiKey: string, field: keyof Detail, value: any) => {
        setDetails((prev) => prev.map((detail) => (
            detail.uiKey === uiKey ? { ...detail, [field]: value } : detail
        )));
    }, []);

    const updateDetailOperation = useCallback((uiKey: string, opName: string, value: boolean) => {
        setDetails((prev) => prev.map((detail) => (
            detail.uiKey === uiKey
                ? {
                    ...detail,
                    operations: { ...detail.operations, [opName]: value },
                }
                : detail
        )));
    }, []);

    const addCustomDetail = useCallback(() => {
        setDetails((prev) => sortParts([
            ...prev,
            {
                uiKey: createDetailUiKey(),
                name: 'Деталь ' + (prev.length + 1),
                countOnSheet: 1,
                // TODO: для пользовательских деталей нужен выбор материала;
                // до появления UI цена листа остаётся нулевой.
                sheetPrice: 0,
                isPrinted: false,
                partsPerSheetOnPrint: 1,
                isCustom: true,
                enabled: true,
                operations: {},
            },
        ]));
    }, []);

    const removeCustomDetail = useCallback((uiKey: string) => {
        setDetails((prev) => prev.filter((detail) => detail.uiKey !== uiKey));
    }, []);

    // --- Layout transfer ---
    // Copies "placed per sheet" from the layout page into the matching details.
    // Names are matched like the prototype (trim/lowercase/ё->е/spaces).
    // A layout part that is not in the construction yet is appended as a custom
    // detail, so a packed part is never silently lost on the way to the price.
    const applyLayoutCounts = useCallback(
        (items: LayoutCount[]): LayoutCountsReport => {
            const byName = new Map<string, LayoutCount>();
            items.forEach((item) => {
                const key = normalizeDetailName(item.name);
                if (key && item.placed > 0 && !byName.has(key)) {
                    byName.set(key, item);
                }
            });

            const updated: string[] = [];
            const added: string[] = [];
            const matched = new Set<string>();

            const next = details.map((detail) => {
                const key = normalizeDetailName(detail.name);
                const item = byName.get(key);
                if (!item) return detail;

                matched.add(key);
                updated.push(`${detail.name} — ${item.placed} шт/лист`);
                return { ...detail, countOnSheet: item.placed, enabled: true };
            });

            byName.forEach((item, key) => {
                if (matched.has(key)) return;

                const name = item.name.trim();
                added.push(`${name} — ${item.placed} шт/лист`);
                next.push({
                    uiKey: createDetailUiKey(),
                    name,
                    countOnSheet: item.placed,
                    // TODO: материал для деталей из раскладки ещё не выбран в UI.
                    sheetPrice: 0,
                    isPrinted: false,
                    partsPerSheetOnPrint: 1,
                    isCustom: true,
                    enabled: true,
                    operations: {},
                });
            });

            // Детали из раскладки добавляются в конец — возвращаем единый порядок.
            setDetails(sortParts(next));
            return { updated, added };
        },
        [details],
    );

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
        // actions
        loadConstruction,
        reloadConstructs,
        calculate: calculateRef,
        updateDetail,
        updateDetailOperation,
        addCustomDetail,
        removeCustomDetail,
        applyLayoutCounts,
        updateExtra,
        addCustomExtra,
        removeCustomExtra,
        updatePriceList,
        updatePrintSettings,
        setWorkPrice,
        setMarginValue,
    };
}

/** Состояние и действия калькулятора, передаваемые странице как единый объект. */
export type CalculatorModel = ReturnType<typeof useCalculator>;
