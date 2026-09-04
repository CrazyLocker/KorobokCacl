// frontend/src/types/index.ts

export interface Detail {
    name: string;
    countOnSheet: number;
    sheetPrice: number;
    isPrinted: boolean;
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

export interface CalculationRequest {
    construction: string;
    details: Detail[];
    extras: Extra[]; // All operations (standard + custom) in a single list
    printSettings: PrintSettings;
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

export interface CalculationResponse {
    totalCost: number;
    basePrice: number;
    branch: string;
    basePriceWithVAT: number;
    printCostPerUnit: number;
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

// Конструкция из БД
export interface ConstructPart {
    name: string;
    perSheet: number;
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

export interface Construct {
    id: string;
    name: string;
    description: string;
    parts: { parts: ConstructPart[] };
    isActive: boolean;
}
