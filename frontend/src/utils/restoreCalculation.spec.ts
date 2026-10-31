// frontend/src/utils/restoreCalculation.spec.ts
import { describe, expect, it } from 'vitest';
import {
    buildDetailRows,
    isRestorableRequest,
    readCalculationIdFromLocation,
} from './restoreCalculation';
import type { ApiDetail, CalculationRequest } from '../types';

const detail = (patch: Partial<ApiDetail> = {}): ApiDetail => ({
    name: 'Дно',
    countOnSheet: 4,
    sheetPrice: 12.5,
    isPrinted: true,
    isCustom: false,
    enabled: true,
    operations: { Лак: true },
    ...patch,
});

const request = (patch: Partial<CalculationRequest> = {}): CalculationRequest => ({
    construction: 'Этне 2 (шубер)',
    details: [detail()],
    extras: [],
    printSettings: { enabled: false, format: 1, quantity: 100 },
    workPrice: 5,
    priceList: {},
    ...patch,
});

describe('readCalculationIdFromLocation', () => {
    it('читает идентификатор расчёта из адресной строки', () => {
        expect(readCalculationIdFromLocation('?calculationId=abc-123')).toBe('abc-123');
        expect(readCalculationIdFromLocation('?foo=1&calculationId=xyz')).toBe('xyz');
    });

    it('возвращает null, когда параметра нет или он пустой', () => {
        expect(readCalculationIdFromLocation('')).toBeNull();
        expect(readCalculationIdFromLocation('?foo=1')).toBeNull();
        expect(readCalculationIdFromLocation('?calculationId=')).toBeNull();
        expect(readCalculationIdFromLocation('?calculationId=%20')).toBeNull();
    });
});

describe('buildDetailRows', () => {
    it('сохраняет поля сохранённого расчёта и выдаёт новые uiKey', () => {
        const rows = buildDetailRows([detail(), detail({ name: 'Крышка' })]);

        expect(rows).toHaveLength(2);
        expect(rows[0].name).toBe('Дно');
        expect(rows[0].sheetPrice).toBe(12.5);
        expect(rows[0].isPrinted).toBe(true);
        expect(rows[0].operations).toEqual({ Лак: true });
        expect(rows[0].uiKey).not.toBe(rows[1].uiKey);
    });

    it('подставляет безопасные значения для полей, которых нет в старых сохранениях', () => {
        const [row] = buildDetailRows([detail()]);

        expect(row.inAssembly).toBe(false);
        expect(row.colsOnSheet).toBe(1);
        expect(row.partsPerSheetOnPrint).toBe(1);
    });

    it('не обнуляет явные количества и режим сборки', () => {
        const [row] = buildDetailRows([detail({ inAssembly: true, colsOnSheet: 3, partsPerSheetOnPrint: 2 })]);

        expect(row.inAssembly).toBe(true);
        expect(row.colsOnSheet).toBe(3);
        expect(row.partsPerSheetOnPrint).toBe(2);
    });
});

describe('isRestorableRequest', () => {
    it('принимает расчёт с конструкцией и деталями', () => {
        expect(isRestorableRequest(request())).toBe(true);
    });

    it('отклоняет пустую конструкцию, пустые детали и null', () => {
        expect(isRestorableRequest(null)).toBe(false);
        expect(isRestorableRequest(request({ construction: '   ' }))).toBe(false);
        expect(isRestorableRequest(request({ details: [] }))).toBe(false);
    });
});
