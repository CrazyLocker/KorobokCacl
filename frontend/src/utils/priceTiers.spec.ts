// frontend/src/utils/priceTiers.spec.ts
import { describe, expect, it } from 'vitest';
import { parseTierLabel, pricedQuantity, tierLabelForQuantity } from './priceTiers';
import type { CalculationRequest } from '../types';

const LABELS = ['до 9', '10–49', '50–199', '200–499', '500–699', '700–1499', 'от 1500'];

const request = (patch: Partial<CalculationRequest> = {}): CalculationRequest => ({
    construction: 'Элара 9',
    details: [],
    extras: [],
    printSettings: { enabled: false, format: 1, quantity: 0 },
    assemblySettings: { enabled: false, format: 1, quantity: 0 },
    workPrice: 5,
    marginValue: 30,
    priceList: {},
    ...patch,
});

describe('parseTierLabel', () => {
    it('читает тир «до»', () => {
        expect(parseTierLabel('до 9')).toEqual({ min: 1, max: 9 });
    });

    it('читает тир «от»', () => {
        expect(parseTierLabel('от 1500')).toEqual({ min: 1500, max: null });
    });

    it('читает диапазон с разными разделителями', () => {
        expect(parseTierLabel('10–49')).toEqual({ min: 10, max: 49 });
        expect(parseTierLabel('200 - 499')).toEqual({ min: 200, max: 499 });
    });

    it('не распознаёт мусор', () => {
        expect(parseTierLabel('спецтираж')).toBeNull();
        expect(parseTierLabel('')).toBeNull();
    });
});

describe('pricedQuantity', () => {
    it('берёт тираж печати, когда печать включена', () => {
        const value = request({
            printSettings: { enabled: true, format: 1, quantity: 230 },
            assemblySettings: { enabled: true, format: 1, quantity: 900 },
        });
        expect(pricedQuantity(value)).toBe(230);
    });

    it('берёт тираж сборки, когда печать выключена', () => {
        const value = request({
            printSettings: { enabled: false, format: 1, quantity: 300 },
            assemblySettings: { enabled: true, format: 1, quantity: 500 },
        });
        expect(pricedQuantity(value)).toBe(500);
    });

    it('возвращает null без включённых режимов', () => {
        expect(pricedQuantity(request())).toBeNull();
        expect(pricedQuantity(null)).toBeNull();
    });
});

describe('tierLabelForQuantity', () => {
    it('находит тир для тиража 230', () => {
        expect(tierLabelForQuantity(LABELS, 230)).toBe('200–499');
    });

    it('попадает в границы включительно', () => {
        expect(tierLabelForQuantity(LABELS, 9)).toBe('до 9');
        expect(tierLabelForQuantity(LABELS, 10)).toBe('10–49');
        expect(tierLabelForQuantity(LABELS, 499)).toBe('200–499');
        expect(tierLabelForQuantity(LABELS, 500)).toBe('500–699');
        expect(tierLabelForQuantity(LABELS, 5000)).toBe('от 1500');
    });

    it('без тиража подсветки нет', () => {
        expect(tierLabelForQuantity(LABELS, null)).toBeNull();
        expect(tierLabelForQuantity(LABELS, 0)).toBeNull();
    });
});
