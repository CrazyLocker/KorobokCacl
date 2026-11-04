// frontend/src/utils/pricedRows.spec.ts
import { describe, expect, it } from 'vitest';
import type { ApiDetail, Extra } from '../types';
import { detailHasPriceEffect, extraHasPriceEffect, splitPriced } from './pricedRows';

const detail = (overrides: Partial<ApiDetail> = {}): ApiDetail => ({
    name: 'Деталь',
    countOnSheet: 1,
    sheetPrice: 0,
    isPrinted: false,
    partsPerSheetOnPrint: 1,
    inAssembly: false,
    colsOnSheet: 1,
    isCustom: false,
    enabled: true,
    operations: {},
    ...overrides,
});

const extra = (overrides: Partial<Extra> = {}): Extra => ({
    name: 'Операция',
    cost: 0,
    enabled: true,
    ...overrides,
});

describe('detailHasPriceEffect', () => {
    it('оставляет деталь с материалом', () => {
        expect(detailHasPriceEffect(detail({ sheetPrice: 120 }))).toBe(true);
    });

    it('оставляет деталь без материала, но с печатью или сборкой', () => {
        expect(detailHasPriceEffect(detail({ isPrinted: true }))).toBe(true);
        expect(detailHasPriceEffect(detail({ inAssembly: true }))).toBe(true);
    });

    it('оставляет деталь с включённой операцией', () => {
        expect(detailHasPriceEffect(detail({ operations: { Вырубка: true, Биговка: false } }))).toBe(true);
    });

    it('скрывает пустую деталь и выключенную', () => {
        expect(detailHasPriceEffect(detail())).toBe(false);
        expect(detailHasPriceEffect(detail({ sheetPrice: 120, enabled: false }))).toBe(false);
    });
});

describe('extraHasPriceEffect', () => {
    it('оставляет платную включённую операцию', () => {
        expect(extraHasPriceEffect(extra({ cost: 15 }))).toBe(true);
    });

    it('скрывает бесплатную или выключенную операцию', () => {
        expect(extraHasPriceEffect(extra({ cost: 0 }))).toBe(false);
        expect(extraHasPriceEffect(extra({ cost: 15, enabled: false }))).toBe(false);
    });
});

describe('splitPriced', () => {
    it('считает скрытые строки, сохраняя порядок видимых', () => {
        const rows = [
            detail({ name: 'A', sheetPrice: 10 }),
            detail({ name: 'B' }),
            detail({ name: 'C', isPrinted: true }),
        ];

        const { visible, hidden } = splitPriced(rows, detailHasPriceEffect);

        expect(visible.map((row) => row.name)).toEqual(['A', 'C']);
        expect(hidden).toBe(1);
    });
});
