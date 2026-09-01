// frontend/src/api/calculatorApi.ts
import axios from 'axios';
import type {
    CalculationRequest,
    CalculationResponse,
    PrintTable,
    Construct,
    PriceListData,
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
};
