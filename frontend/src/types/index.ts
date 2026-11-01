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
    // Первая версия дерева: у всех версий одного расчёта rootId одинаков.
    rootId?: string;
    // Номер версии в ветке, начиная с 1.
    version?: number;
    // Идентификатор самой свежей ветки: с неё продолжают работу из списка.
    latestId?: string;
    // Сколько живых версий в дереве.
    versionCount?: number;
    name: string;
    clientName: string;
    // Клиент справочника; null у расчётов, сохранённых до его появления.
    customerId?: string | null;
    managerName: string;
    status: 'draft' | 'ready' | 'sent' | 'in_work' | 'closed';
    calculation: CalculationRequest;
    createdAt: string;
    updatedAt: string;
}

// Запрос на сохранение расчёта
export interface CalculationSaveRequest {
    name: string;
    // Клиент справочника; можно не передавать, тогда бэкенд найдёт/создаст его
    // по clientName.
    customerId?: string | null;
    clientName?: string;
    managerName: string;
    calculation: CalculationRequest;
}

// Клиент справочника
export interface Customer {
    id: string;
    name: string;
    inn?: string | null;
    contact?: string | null;
    active: boolean;
    createdAt: string;
    updatedAt: string;
}

// Запрос на создание/правку клиента
export interface CustomerSaveRequest {
    name: string;
    inn?: string | null;
    contact?: string | null;
    active?: boolean;
}

// Заказ клиента: сделка, выросшая из одной версии расчёта
export interface CalculationOrder {
    id: string;
    customerId: string;
    customerName: string;
    number: string;
    orderDate: string;
    status: SavedCalculation['status'];
    comment?: string | null;
    // Версия, из которой вырос заказ; остальные версии остаются в дереве.
    sourceCalculationId: string | null;
    // Номер этой версии, например 3 для v3.
    sourceVersion: number | null;
    sourceCalculationName: string | null;
    sourceCalculationUpdatedAt: string | null;
    // Свежая ветка расчёта-источника: с неё продолжают работу.
    sourceCalculationLatestId: string | null;
    // Стоимость версии-источника; null — снапшота нет.
    totalCost: number | null;
    createdAt: string;
    updatedAt: string;
}

// Запрос на создание/правку заказа
export interface CalculationOrderSaveRequest {
    // Версия, из которой создаётся заказ; клиент берётся у неё.
    sourceCalculationId: string;
    // Пусто — бэкенд сгенерирует номер вида 2026-001.
    number?: string | null;
    orderDate?: string | null;
    status?: SavedCalculation['status'];
    comment?: string | null;
}

// Расчёт в дереве «Клиент → Заказы/Расчёты»
export interface CalculationTree {
    id: string;
    customerId: string | null;
    name: string;
    managerName: string;
    latestId: string;
    version: number;
    versionCount: number;
    totalCost: number | null;
    updatedAt: string;
}

// Узел заказа в дереве расчётов
export interface OrderTree {
    id: string;
    customerId: string | null;
    number: string;
    orderDate: string;
    status: SavedCalculation['status'];
    totalCost: number | null;
    // Версия, из которой вырос заказ.
    sourceCalculationId: string | null;
    sourceVersion: number | null;
    sourceCalculationName: string | null;
    sourceCalculationUpdatedAt: string | null;
    sourceCalculationLatestId: string | null;
}

// Узел клиента в дереве расчётов
export interface CustomerTree {
    id: string | null;
    name: string;
    // Заказы клиента; заказ растёт из версии, но не забирает расчёт из дерева.
    orders: OrderTree[];
    // Все живые расчёты клиента, включая те, из которых уже сделан заказ.
    calculations: CalculationTree[];
}

// Вид расчёта (read-only): метаданные, сохранённый запрос и результат
// пересчёта, который считает бэкенд из сохранённого state.
export interface CalculationView {
    id: string;
    // Номер версии в ветке расчёта.
    version?: number;
    // Версия, из которой сделана эта; null у корня дерева.
    parentId?: string | null;
    // Версия помечена удалённой, но осталась в истории.
    deleted?: boolean;
    name: string;
    clientName: string;
    managerName: string;
    status: SavedCalculation['status'];
    createdAt: string;
    updatedAt: string;
    // null — сохранённый state не удалось разобрать в запрос.
    request: CalculationRequest | null;
    // null — пересчёт не удался; причина в viewError.
    result: CalculationResponse | null;
    viewError?: string | null;
}

// Заказ, выросший из версии расчёта: показывает, какой вариант ушёл клиенту.
export interface CalculationVersionOrder {
    id: string;
    number: string;
}

// Одна версия дерева сохранённого расчёта (история правок).
export interface CalculationVersion {
    // Идентификатор версии: по нему открывается её состояние.
    id: string;
    // Номер версии в ветке, начиная с 1 (родитель + 1).
    version: number;
    // Версия, из которой сделана эта; null у корня дерева.
    parentId: string | null;
    // Версия помечена удалённой, но осталась в истории.
    deleted: boolean;
    name: string;
    clientName: string;
    managerName: string;
    status: SavedCalculation['status'];
    // Себестоимость из снапшота версии; null у записей до появления снапшотов.
    totalCost: number | null;
    // Признак конца ветки: у версии нет детей.
    latest: boolean;
    // Заказы, выросшие из этой версии: из одного варианта их может быть несколько.
    orders: CalculationVersionOrder[];
    createdAt: string;
    updatedAt: string;
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

// Режим расчёта ножа — чекбоксы «Учитывать трансформации» / «Учитывать единицы измерения».
// По умолчанию оба включены, как в прототипе.
export interface KnifeOptions {
    useTransform: boolean;
    useUnits: boolean;
}

// Элемент контура в ответе /api/knife/calculate
export interface KnifeElement {
    type: string;
    lengthPx: number;
    lengthMm: number;
    hasTransform: boolean;
}

// Результат расчёта ножа (ответ /api/knife/calculate)
export interface KnifeResult {
    totalLengthPx: number;
    totalLengthMm: number;
    knifeCost: number;
    scale: number;
    // Источник масштаба: 'width/height атрибуты', 'viewBox как мм', …
    scaleSource?: string;
    // Единица измерения корня документа: mm/cm/in/pt/pc/px
    unit?: string;
    elements?: KnifeElement[];
    // Устаревшее поле без флага transform — оставлено для обратной совместимости.
    details?: { type: string; lengthPx: number; lengthMm: number }[];
    // Ошибка разбора SVG (битый XML, DOCTYPE с недоступным DTD и т.п.).
    // null/undefined — разбор прошёл; иначе длины нулевые и показываем ошибку.
    parseError?: string | null;
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
