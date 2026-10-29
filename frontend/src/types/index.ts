// frontend/src/types/index.ts

export interface Detail {
    // Client-only stable row id for React keys and edits.
    // It is stripped by toApiDetails before any API request.
    uiKey: string;
    name: string;
    countOnSheet: number;
    sheetPrice: number;
    isPrinted: boolean;
    // Number of identical parts printed on one print sheet.
    // Optional for backward compatibility with saved calculations; null/0 means 1.
    partsPerSheetOnPrint?: number;
    // Режим «Сборка на печатный лист»: деталь кладётся на лист сборки.
    // Optional: сохранённые расчёты без режима сборки поля не содержат.
    inAssembly?: boolean;
    // Сколько копий этой детали лежит на листе сборки («кол-во на лист»).
    // Optional: null/undefined означает 1; явный 0 бэкенд отклоняет.
    colsOnSheet?: number;
    isCustom: boolean;
    enabled: boolean;
    // Unified map for all operations (standard + custom).
    // Key — operation name, value — enabled/disabled for this detail.
    operations: Record<string, boolean>;
}

export interface Extra {
    name: string;
    cost: number;
    enabled: boolean;
    isCustom?: boolean;
}

export interface PrintSettings {
    enabled: boolean;
    format: number;
    quantity: number;
}

/**
 * Режим «Сборка на печатный лист»: один лист несёт комплект деталей,
 * тираж каждой детали равен заданному quantity (1 коробка = 1 комплект).
 * Взаимоисключающий с режимом печати одной детали (isPrinted).
 */
export interface AssemblySettings {
    enabled: boolean;
    // Формат печати (print_tables.formatId).
    format: number;
    // Тираж детали. 0 = ещё не задан: при включении берётся тираж печати.
    quantity: number;
}

/** Detail as it is sent to backend: no client-only fields. */
export type ApiDetail = Omit<Detail, 'uiKey'>;

export interface CalculationRequest {
    construction: string;
    details: ApiDetail[];
    extras: Extra[]; // All operations (standard + custom) in a single list
    printSettings: PrintSettings;
    // Режим сборки; отсутствует/disabled — считается обычная печать.
    assemblySettings?: AssemblySettings;
    workPrice: number;
    marginValue?: number; // Плечо (+N), по умолчанию 30
    priceList: Record<string, number>;
}

export interface PriceRow {
    label: string;
    withoutVAT: number;
    calculatedPrice: number;
    priceListPrice: number;
    finalPrice: number;
    isBase: boolean;
    isPriceListUsed: boolean;
}

/** Печать одной детали в режиме сборки: доля общего счёта листа. */
export interface DetailCost {
    // Индекс детали в списке details запроса (0-based, порядок сохраняется).
    detailId: number;
    // Себестоимость печати одной копии детали без НДС, ₽.
    perPart: number;
    inAssembly: boolean;
    colsOnSheet: number;
    // Тираж листов прогона; 0 — деталь не печатается.
    sheets: number;
    // Деталь отмечена, но прогон не имеет цены (например, нет таблицы печати).
    printBlocked: boolean;
}

export interface CalculationResponse {
    totalCost: number;
    basePrice: number;
    branch: string;
    basePriceWithVAT: number;
    printCostPerUnit: number;
    // «Сборка на печатный лист»: null/undefined, когда режим выключен.
    // Устаревшие поля, сохранены для совместимости; используйте details.
    assemblyCostPerPart?: number | null;
    assemblySheetCost?: number | null;
    assemblySheets?: number | null;
    assemblyPartsOnSheet?: number | null;
    // Печать по деталям в порядке запроса; null/undefined вне режима сборки.
    details?: DetailCost[] | null;
    prices: PriceRow[];
}

export interface PrintTable {
    id: string;
    formatId: number;
    formatName: string;
    steps: { minQty: number; price: number }[];
    stepAfter3000: number;
}

export interface PriceListData {
    id: string | null;
    constructId: string;
    priceData: Record<string, number>;
}

// Деталь конструкции. Цена листа хранится в самой детали: «какой картон» —
// вне модели, калькулятор знает только цену.
export interface Part {
    id: string;
    name: string;
    perSheet: number;
    pricePerSheet: number;
}

// Операция из БД (справочник дополнительных операций)
export interface Operation {
    id: string;
    name: string;
    unit: string;
    basePrice: number;
    priceType?: string;
    isActive?: boolean;
}

// Сохранённый расчёт коробки
export interface SavedCalculation {
    id: string;
    name: string;
    clientName: string;
    managerName: string;
    status: 'draft' | 'ready' | 'sent' | 'in_work' | 'closed';
    calculation: CalculationRequest;
    createdAt: string;
    updatedAt: string;
}

// Запрос на сохранение расчёта
export interface CalculationSaveRequest {
    name: string;
    clientName: string;
    managerName: string;
    calculation: CalculationRequest;
}

// Сохранённый нож
export interface SavedKnife {
    id: string;
    name: string;
    totalLengthMm: number;
    knifeCost: number;
    clientName: string;
    managerName: string;
    createdAt: string;
}

// Запрос на сохранение ножа
export interface KnifeSaveRequest {
    name: string;
    svgContent: string;
    totalLengthMm: number;
    knifeCost: number;
    clientName: string;
    managerName: string;
}

// Конструкция из БД
export interface Construct {
    id: string;
    name: string;
    description?: string;
    type?: string;
    parts: Part[];
    isActive: boolean;
}
