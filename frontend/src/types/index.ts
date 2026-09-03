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
    id: string | null;
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
