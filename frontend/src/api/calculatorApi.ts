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
    CalculationView,
    CalculationVersion,
    Customer,
    CustomerSaveRequest,
    CalculationOrder,
    CalculationOrderSaveRequest,
    CustomerTree,
    SavedKnife,
    KnifeSaveRequest,
    KnifeOptions,
    KnifeResult,
    Operation,
} from '../types';
import { buildKnifeRequest } from '../utils/knifeRequest';

const API_BASE = '/api';

/**
 * Все сообщения об ошибках в интерфейсе — на русском, поэтому технический
 * текст axios («Request failed with status code 500», «Network Error»)
 * заменяется на причину с бэкенда или понятную формулировку.
 */
axios.interceptors.response.use(
    (response) => response,
    (error: unknown) => {
        if (axios.isAxiosError<{ message?: string; errors?: Record<string, string> }>(error)) {
            const data = error.response?.data;
            const details = data?.errors
                ? Object.values(data.errors).filter(Boolean).join('; ')
                : '';
            error.message = details
                || data?.message
                || (error.response
                    ? `Ошибка сервера (HTTP ${error.response.status})`
                    : 'Сервер недоступен: проверьте, запущен ли бэкенд');
        }
        return Promise.reject(error);
    },
);

export const calculatorApi = {
    // === Калькулятор ===
    // signal отменяет устаревший расчёт: пока пользователь меняет параметры,
    // предыдущий ответ уже не нужен и не должен перебивать свежий.
    calculate: (data: CalculationRequest, signal?: AbortSignal): Promise<CalculationResponse> =>
        axios.post(`${API_BASE}/calculator/calculate`, data, { signal }).then((res) => res.data),

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

    // Сохранение правки: новая версия ветки, метаданные наследуются от родителя.
    // Заказ из версии создаётся отдельно (createOrder) — расчёт остаётся в дереве.
    iterateCalculation: (id: string, data: CalculationRequest): Promise<SavedCalculation> =>
        axios.post(`${API_BASE}/calculations/${id}/iterate`, data).then((res) => res.data),

    getCalculationView: (id: string): Promise<CalculationView> =>
        axios.get(`${API_BASE}/calculations/${id}/view`).then((res) => res.data),

    // История версий: вся цепочка расчёта, от новой к старой.
    getCalculationVersions: (id: string): Promise<CalculationVersion[]> =>
        axios.get(`${API_BASE}/calculations/${id}/versions`).then((res) => res.data),

    // Дерево «Клиент → Заказ → Расчёт» для списка сохранённых расчётов.
    getCalculationTree: (): Promise<CustomerTree[]> =>
        axios.get(`${API_BASE}/calculations/tree`).then((res) => res.data),

    // === Клиенты ===
    listCustomers: (): Promise<Customer[]> =>
        axios.get(`${API_BASE}/customers`).then((res) => res.data),

    createCustomer: (data: CustomerSaveRequest): Promise<Customer> =>
        axios.post(`${API_BASE}/customers`, data).then((res) => res.data),

    updateCustomer: (id: string, data: CustomerSaveRequest): Promise<Customer> =>
        axios.put(`${API_BASE}/customers/${id}`, data).then((res) => res.data),

    // === Заказы ===
    listOrders: (customerId?: string): Promise<CalculationOrder[]> =>
        axios.get(`${API_BASE}/orders`, { params: customerId ? { customerId } : undefined })
            .then((res) => res.data),

    createOrder: (data: CalculationOrderSaveRequest): Promise<CalculationOrder> =>
        axios.post(`${API_BASE}/orders`, data).then((res) => res.data),

    updateOrder: (id: string, data: CalculationOrderSaveRequest): Promise<CalculationOrder> =>
        axios.put(`${API_BASE}/orders/${id}`, data).then((res) => res.data),

    // Пометка заказа удалённым: строка остаётся в дереве зачёркнутой.
    deleteOrder: (id: string): Promise<void> =>
        axios.delete(`${API_BASE}/orders/${id}`).then(() => {}),

    deleteCalculation: (id: string): Promise<void> =>
        axios.delete(`${API_BASE}/calculations/${id}`).then(() => {}),

    // Полное удаление ветки: строки исчезают из базы, история их не хранит.
    purgeCalculation: (id: string): Promise<void> =>
        axios.delete(`${API_BASE}/calculations/${id}/purge`).then(() => {}),

    // === Блок очистки: только помеченные записи ===
    purgeCalculations: (ids: string[]): Promise<number> =>
        axios.post(`${API_BASE}/calculations/purge`, { ids }).then((res) => res.data.deleted),

    purgeOrders: (ids: string[]): Promise<number> =>
        axios.post(`${API_BASE}/orders/purge`, { ids }).then((res) => res.data.deleted),

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
    calculateKnife: (svgContent: string, options?: Partial<KnifeOptions>): Promise<KnifeResult> =>
        axios
            .post(`${API_BASE}/knife/calculate`, buildKnifeRequest(svgContent, options))
            .then((res) => res.data),
};

