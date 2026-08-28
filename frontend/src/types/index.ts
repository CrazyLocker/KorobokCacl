// frontend/src/types/index.ts

export interface Detail {
    name: string;
    countOnSheet: number;
    sheetPrice: number;
    isPrinted: boolean;
    isCustom: boolean;
    enabled: boolean;
    hasLak: boolean;
    hasCongrev: boolean;
    hasTisnenie: boolean;
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
    extras: Extra[];
    customExtras: Extra[];
    printSettings: PrintSettings;
    workPrice: number;
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
    id: string;
    constructId: string;
    priceData: Record<string, number>;
}

// Конструкция из БД
export interface ConstructPart {
    name: string;
    perSheet: number;
}

export interface Construct {
    id: string;
    name: string;
    description: string;
    parts: { parts: ConstructPart[] };
    isActive: boolean;
}
