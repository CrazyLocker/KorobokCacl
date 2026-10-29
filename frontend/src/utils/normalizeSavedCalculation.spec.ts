// frontend/src/utils/normalizeSavedCalculation.spec.ts
import { describe, expect, it } from 'vitest';
import {
    PRICE_LIST_TIERS,
    normalizeSavedCalculation,
} from './normalizeSavedCalculation';

/** Минимальный сохранённый state: конструкция, одна деталь, работа. */
const minimalState = (overrides: Record<string, unknown> = {}) => ({
    construction: 'Этне 2 (шубер)',
    details: [{ name: 'Дно', countOnSheet: 4, sheetPrice: 35, enabled: true }],
    workPrice: 5,
    ...overrides,
});

describe('normalizeSavedCalculation', () => {
    it('подставляет дефолты для отсутствующих блоков', () => {
        const request = normalizeSavedCalculation(minimalState());

        expect(request.construction).toBe('Этне 2 (шубер)');
        expect(request.printSettings).toEqual({ enabled: false, format: 1, quantity: 100 });
        expect(request.assemblySettings).toEqual({ enabled: false, format: 1, quantity: 0 });
        expect(request.extras).toEqual([]);
        expect(request.marginValue).toBeUndefined();
        expect(Object.keys(request.priceList)).toEqual(PRICE_LIST_TIERS);
        expect(Object.values(request.priceList).every((price) => price === 0)).toBe(true);
        expect(request.details[0].colsOnSheet).toBe(1);
        expect(request.details[0].operations).toEqual({});
    });

    it('читает легаси-алиасы partsPerSheetInAssembly и boxQuantity', () => {
        const request = normalizeSavedCalculation(minimalState({
            details: [{
                name: 'Крышка',
                countOnSheet: 2,
                sheetPrice: 35,
                enabled: true,
                inAssembly: true,
                partsPerSheetInAssembly: 3,
                operations: { Лак: true, Тиснение: false },
            }],
            assemblySettings: { enabled: true, format: 2, boxQuantity: 50 },
        }));

        expect(request.details[0].colsOnSheet).toBe(3);
        expect(request.details[0].inAssembly).toBe(true);
        expect(request.details[0].operations).toEqual({ Лак: true, Тиснение: false });
        expect(request.assemblySettings).toEqual({ enabled: true, format: 2, quantity: 50 });
    });

    it('явный colsOnSheet важнее алиаса', () => {
        const request = normalizeSavedCalculation(minimalState({
            details: [{
                name: 'Дно',
                countOnSheet: 1,
                sheetPrice: 10,
                colsOnSheet: 2,
                partsPerSheetInAssembly: 9,
            }],
        }));

        expect(request.details[0].colsOnSheet).toBe(2);
    });

    it('приводит числовые строки и сохраняет прайс-лист', () => {
        const request = normalizeSavedCalculation(minimalState({
            workPrice: '7.5',
            marginValue: '15',
            details: [{ name: 'Дно', countOnSheet: '4', sheetPrice: '35' }],
            printSettings: { enabled: true, format: '3', quantity: '300' },
            priceList: { '10–49': '99' },
        }));

        expect(request.workPrice).toBe(7.5);
        expect(request.marginValue).toBe(15);
        expect(request.details[0].countOnSheet).toBe(4);
        expect(request.details[0].sheetPrice).toBe(35);
        expect(request.printSettings).toEqual({ enabled: true, format: 3, quantity: 300 });
        expect(request.priceList['10–49']).toBe(99);
        expect(request.priceList['до 9']).toBe(0);
    });

    it('выключает печать, если включена сборка', () => {
        const request = normalizeSavedCalculation(minimalState({
            printSettings: { enabled: true, format: 1, quantity: 100 },
            assemblySettings: { enabled: true, format: 2, quantity: 50 },
        }));

        expect(request.assemblySettings).toEqual({ enabled: true, format: 2, quantity: 50 });
        expect(request.printSettings).toEqual({ enabled: false, format: 1, quantity: 100 });
    });

    it('не трогает уже выключенную печать при включённой сборке', () => {
        const request = normalizeSavedCalculation(minimalState({
            printSettings: { enabled: false, format: 3, quantity: 200 },
            assemblySettings: { enabled: true, format: 2, quantity: 50 },
        }));

        expect(request.assemblySettings?.enabled).toBe(true);
        expect(request.printSettings).toEqual({ enabled: false, format: 3, quantity: 200 });
    });

    it('не трогает печать, когда сборка выключена', () => {
        const request = normalizeSavedCalculation(minimalState({
            printSettings: { enabled: true, format: 1, quantity: 100 },
            assemblySettings: { enabled: false, format: 1, quantity: 0 },
        }));

        expect(request.printSettings).toEqual({ enabled: true, format: 1, quantity: 100 });
        expect(request.assemblySettings).toEqual({ enabled: false, format: 1, quantity: 0 });
    });

    it('оставляет оба режима выключенными', () => {
        const request = normalizeSavedCalculation(minimalState({
            printSettings: { enabled: false, format: 1, quantity: 100 },
            assemblySettings: { enabled: false, format: 1, quantity: 0 },
        }));

        expect(request.printSettings.enabled).toBe(false);
        expect(request.assemblySettings?.enabled).toBe(false);
    });

    it('бросает понятную ошибку для неполных данных', () => {
        expect(() => normalizeSavedCalculation(null))
            .toThrow('пустые или повреждённые данные');
        expect(() => normalizeSavedCalculation('broken'))
            .toThrow('пустые или повреждённые данные');
        expect(() => normalizeSavedCalculation(minimalState({ construction: '  ' })))
            .toThrow('не указана конструкция');
        expect(() => normalizeSavedCalculation(minimalState({ details: [] })))
            .toThrow('нет деталей');
        expect(() => normalizeSavedCalculation(minimalState({ details: 'broken' })))
            .toThrow('нет деталей');
        expect(() => normalizeSavedCalculation(minimalState({ workPrice: undefined })))
            .toThrow('workPrice');
        expect(() => normalizeSavedCalculation(minimalState({ details: [null] })))
            .toThrow('деталь №1 повреждена');
    });
});
