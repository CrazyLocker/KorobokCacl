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
    calculate: (data: CalculationRequest): Promise<CalculationResponse> =>
        axios.post(`${API_BASE}/calculator/calculate`, data).then((res) => res.data),

    getConstructs: (): Promise<Construct[]> =>
        axios.get(`${API_BASE}/constructs`).then((res) => res.data),

    getPrintTables: (): Promise<PrintTable[]> =>
        axios.get(`${API_BASE}/print-tables`).then((res) => res.data),

    getPriceList: (constructId: string): Promise<PriceListData | null> =>
        axios.get(`${API_BASE}/price-lists/by-construct/${constructId}`).then((res) => res.data || null),
};
