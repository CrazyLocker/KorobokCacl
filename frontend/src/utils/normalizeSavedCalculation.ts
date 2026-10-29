// frontend/src/utils/normalizeSavedCalculation.ts
import type {
    ApiDetail, AssemblySettings, CalculationRequest, Extra, PrintSettings,
} from '../types';

/**
 * Тиры прайс-листа в порядке бэкенда (PriceCalculator.tierLabels).
 * Нужны, чтобы у сохранённого расчёта без priceList были все 7 строк.
 */
export const PRICE_LIST_TIERS = [
    'до 9', '10–49', '50–199', '200–499', '500–699', '700–1499', 'от 1500',
];

const DEFAULT_PRINT_SETTINGS: PrintSettings = { enabled: false, format: 1, quantity: 100 };
const DEFAULT_ASSEMBLY_SETTINGS: AssemblySettings = { enabled: false, format: 1, quantity: 0 };

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null && !Array.isArray(value);

/** Число из JSON: принимает и number, и числовую строку легаси-данных. */
const toNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
};

const toBoolean = (value: unknown, fallback = false): boolean =>
    typeof value === 'boolean' ? value : fallback;

const toText = (value: unknown): string => (typeof value === 'string' ? value : '');

/** Обязательное числовое поле: без него расчёт показывать нечем. */
const requireNumber = (value: unknown, field: string): number => {
    const parsed = toNumber(value);
    if (parsed === undefined) {
        throw new Error(`Сохранённый расчёт: поле «${field}» отсутствует или не число`);
    }
    return parsed;
};

/** Карта операций детали: ключ — название, значение — включена ли операция. */
const toOperations = (value: unknown): Record<string, boolean> => {
    if (!isRecord(value)) return {};
    const operations: Record<string, boolean> = {};
    Object.entries(value).forEach(([name, flag]) => {
        operations[name] = flag === true;
    });
    return operations;
};

/**
 * Деталь сохранённого расчёта.
 *
 * <p>Старое имя {@code partsPerSheetInAssembly} читается как {@code colsOnSheet}:
 * бэкенд принимает его через {@code @JsonAlias}, а UI работает только с новым.
 */
const toDetail = (value: unknown, index: number): ApiDetail => {
    if (!isRecord(value)) {
        throw new Error(`Сохранённый расчёт: деталь №${index + 1} повреждена`);
    }
    const colsOnSheet = toNumber(value.colsOnSheet)
        ?? toNumber(value.partsPerSheetInAssembly)
        ?? 1;
    const partsPerSheetOnPrint = toNumber(value.partsPerSheetOnPrint);

    const detail: ApiDetail = {
        name: toText(value.name),
        countOnSheet: toNumber(value.countOnSheet) ?? 0,
        sheetPrice: toNumber(value.sheetPrice) ?? 0,
        isPrinted: toBoolean(value.isPrinted),
        inAssembly: toBoolean(value.inAssembly),
        colsOnSheet,
        isCustom: toBoolean(value.isCustom),
        enabled: toBoolean(value.enabled),
        operations: toOperations(value.operations),
    };
    if (partsPerSheetOnPrint !== undefined) {
        detail.partsPerSheetOnPrint = partsPerSheetOnPrint;
    }
    return detail;
};

/** Доп. операция: без валидной записи подставляем пустую строку и 0 ₽. */
const toExtra = (value: unknown): Extra => {
    if (!isRecord(value)) return { name: '', cost: 0, enabled: false, isCustom: false };
    return {
        name: toText(value.name),
        cost: toNumber(value.cost) ?? 0,
        enabled: toBoolean(value.enabled),
        isCustom: toBoolean(value.isCustom),
    };
};

/** Настройки печати одной детали; отсутствие блока = режим выключен. */
const toPrintSettings = (value: unknown): PrintSettings => {
    if (!isRecord(value)) return { ...DEFAULT_PRINT_SETTINGS };
    return {
        enabled: toBoolean(value.enabled),
        format: toNumber(value.format) ?? DEFAULT_PRINT_SETTINGS.format,
        quantity: toNumber(value.quantity) ?? DEFAULT_PRINT_SETTINGS.quantity,
    };
};

/**
 * Настройки «Сборка на печатный лист».
 *
 * <p>Старое имя {@code boxQuantity} читается как {@code quantity}.
 */
const toAssemblySettings = (value: unknown): AssemblySettings => {
    if (!isRecord(value)) return { ...DEFAULT_ASSEMBLY_SETTINGS };
    return {
        enabled: toBoolean(value.enabled),
        format: toNumber(value.format) ?? DEFAULT_ASSEMBLY_SETTINGS.format,
        quantity: toNumber(value.quantity)
            ?? toNumber(value.boxQuantity)
            ?? DEFAULT_ASSEMBLY_SETTINGS.quantity,
    };
};

/** Прайс-лист: всегда все 7 тиров, незаполненные — 0 (как в калькуляторе). */
const toPriceList = (value: unknown): Record<string, number> => {
    const priceList: Record<string, number> = {};
    PRICE_LIST_TIERS.forEach((tier) => {
        priceList[tier] = 0;
    });
    if (!isRecord(value)) return priceList;
    PRICE_LIST_TIERS.forEach((tier) => {
        const price = toNumber(value[tier]);
        if (price !== undefined) priceList[tier] = price;
    });
    return priceList;
};

/**
 * Разрешает конфликт режимов у старых сохранений.
 *
 * <p>«Сборка на печатный лист» сама печатает детали, поэтому режимы
 * взаимоисключающие: если в state включены оба, сборка выигрывает, а обычная
 * печать гасится — иначе бэкенд отказывается считать. Когда сборка выключена,
 * флаги не трогаем.
 *
 * @param request нормализованный запрос, меняется на месте
 */
const resolveModeConflict = (request: CalculationRequest): void => {
    if (request.assemblySettings?.enabled === true) {
        request.printSettings.enabled = false;
    }
};

/**
 * Приводит сохранённый state расчёта к {@link CalculationRequest}.
 *
 * <p>Виджет «Вид расчёта» показывает только числа, поэтому все необязательные
 * блоки получают дефолты, а критичные поля (конструкция, детали, работа)
 * проверяются: без них расчёт показывать нечем.
 *
 * @param raw значение поля calculation/view.request из API
 * @returns нормализованный запрос
 * @throws Error если данные пустые или критично неполные
 */
export const normalizeSavedCalculation = (raw: unknown): CalculationRequest => {
    if (!isRecord(raw)) {
        throw new Error('Сохранённый расчёт: пустые или повреждённые данные');
    }

    const construction = toText(raw.construction).trim();
    if (!construction) {
        throw new Error('Сохранённый расчёт: не указана конструкция');
    }

    if (!Array.isArray(raw.details) || raw.details.length === 0) {
        throw new Error('Сохранённый расчёт: нет деталей');
    }

    const request: CalculationRequest = {
        construction,
        details: raw.details.map(toDetail),
        extras: Array.isArray(raw.extras) ? raw.extras.map(toExtra) : [],
        printSettings: toPrintSettings(raw.printSettings),
        assemblySettings: toAssemblySettings(raw.assemblySettings),
        workPrice: requireNumber(raw.workPrice, 'workPrice'),
        priceList: toPriceList(raw.priceList),
    };

    // Алиасы и дефолты применены — можно разрешать конфликт режимов.
    resolveModeConflict(request);

    const marginValue = toNumber(raw.marginValue);
    if (marginValue !== undefined) {
        request.marginValue = marginValue;
    }
    return request;
};
