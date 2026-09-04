// frontend/src/api/calculatorApi.ts
import axios from 'axios';
import type {
    CalculationRequest,
    CalculationResponse,
    PrintTable,
    Construct,
    PriceListData,
    SavedCalculation,
    CalculationSaveRequest,
    SavedKnife,
    KnifeSaveRequest,
} from '../types';

const API_BASE = '/api';

export const calculatorApi = {
    // === Калькулятор ===
    calculate: (data: CalculationRequest): Promise<CalculationResponse> =>
        axios.post(`${API_BASE}/calculator/calculate`, data).then((res) => res.data),

    // === Конструкции ===
    getConstructs: (): Promise<Construct[]> =>
        axios.get(`${API_BASE}/constructs`).then((res) => res.data),

    saveConstruct: (construct: Construct): Promise<Construct> =>
        axios.post(`${API_BASE}/constructs`, construct).then((res) => res.data),

    updateConstruct: (id: string, construct: Construct): Promise<Construct> =>
        axios.put(`${API_BASE}/constructs/${id}`, construct).then((res) => res.data),

    deleteConstruct: (id: string): Promise<void> =>
        axios.delete(`${API_BASE}/constructs/${id}`).then(() => {}),

    // === Прайс-листы ===
    getPriceList: (constructId: string): Promise<PriceListData | null> =>
        axios.get(`${API_BASE}/price-lists/by-construct/${constructId}`).then((res) => res.data || null),

    savePriceList: (data: PriceListData): Promise<PriceListData> =>
        axios.post(`${API_BASE}/price-lists`, data).then((res) => res.data),

    updatePriceList: (id: string, data: PriceListData): Promise<PriceListData> =>
        axios.put(`${API_BASE}/price-lists/${id}`, data).then((res) => res.data),

    deletePriceList: (id: string): Promise<void> =>
        axios.delete(`${API_BASE}/price-lists/${id}`).then(() => {}),

    // === Таблицы печати ===
    getPrintTables: (): Promise<PrintTable[]> =>
        axios.get(`${API_BASE}/print-tables`).then((res) => res.data),
    savePrintTable: (table: PrintTable): Promise<PrintTable> =>
        axios.post(`${API_BASE}/print-tables`, table).then((res) => res.data),

    updatePrintTable: (id: string, table: PrintTable): Promise<PrintTable> =>
        axios.put(`${API_BASE}/print-tables/${id}`, table).then((res) => res.data),

    deletePrintTable: (id: string): Promise<void> =>
        axios.delete(`${API_BASE}/print-tables/${id}`).then(() => {}),

    // === Операции (дополнительные операции) ===
    getOperations: (): Promise<Operation[]> =>
        axios.get(`${API_BASE}/operations`).then((res) => res.data),

    // === Сохранённые расчёты ===
    saveCalculation: (data: CalculationSaveRequest): Promise<SavedCalculation> =>
        axios.post(`${API_BASE}/calculations/save`, data).then((res) => res.data),

    listCalculations: (): Promise<SavedCalculation[]> =>
        axios.get(`${API_BASE}/calculations/list`).then((res) => res.data),

    getCalculation: (id: string): Promise<SavedCalculation> =>
        axios.get(`${API_BASE}/calculations/${id}`).then((res) => res.data),

    deleteCalculation: (id: string): Promise<void> =>
        axios.delete(`${API_BASE}/calculations/${id}`).then(() => {}),

    // === Сохранённые ножи ===
    saveKnife: (data: KnifeSaveRequest): Promise<SavedKnife> =>
        axios.post(`${API_BASE}/knife/save`, data).then((res) => res.data),

    listKnives: (): Promise<SavedKnife[]> =>
        axios.get(`${API_BASE}/knife/list`).then((res) => res.data),

    deleteKnife: (id: string): Promise<void> =>
        axios.delete(`${API_BASE}/knife/${id}`).then(() => {}),

    // === Импорт справочников ===
    importConstructs: (data: Record<string, any>): Promise<any> =>
        axios.post(`${API_BASE}/references/import-constructs`, data).then((res) => res.data),

    importPriceLists: (data: Record<string, any>): Promise<any> =>
        axios.post(`${API_BASE}/references/import-price-lists`, data).then((res) => res.data),

    importPrintTables: (data: Record<string, any>): Promise<any> =>
        axios.post(`${API_BASE}/references/import-print-tables`, data).then((res) => res.data),

    // === Калькулятор ножа ===
    calculateKnife: (svgContent: string): Promise<any> =>
        axios.post(`${API_BASE}/knife/calculate`, { svgContent }).then((res) => res.data),
};
