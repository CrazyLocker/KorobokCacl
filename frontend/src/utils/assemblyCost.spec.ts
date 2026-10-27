// frontend/src/utils/assemblyCost.spec.ts
import { describe, expect, it } from 'vitest';
import { calcAssemblyRun } from './assemblyCost';
import type { PrintTable } from '../types';

/** Таблица печати как в БД: ступени 100/300/500 и шаг +1500 за 1000 после 3000. */
const table = (): PrintTable => ({
    id: 't1',
    formatId: 1,
    formatName: '70×100',
    steps: [
        { minQty: 100, price: 5500 },
        { minQty: 300, price: 7500 },
        { minQty: 500, price: 9000 },
    ],
    stepAfter3000: 1500,
});

describe('calcAssemblyRun', () => {
    it('200 коробок, комплект из 3 деталей → 200 листов по тарифу 300', () => {
        // 200 листов → тариф 300 (7500) → 25 ₽/лист → 25/3 ₽ за деталь
        const run = calcAssemblyRun(table(), 200, 3, 3);

        expect(run.setsPerSheet).toBe(1);
        expect(run.sheets).toBe(200);
        expect(run.tariffSheets).toBe(300);
        expect(run.sheetCost).toBe(25);
        expect(run.perPart).toBeCloseTo(8.3333, 4);
        // себестоимость коробки: 8.33 × 3 детали ≈ 25 ₽
        expect(run.perPart * 3).toBeCloseTo(25, 10);
    });

    it('2 комплекта на листе → вдвое меньше листов', () => {
        // 6 деталей на листе при 3 в коробке → 2 комплекта → 200 коробок = 100 листов
        const run = calcAssemblyRun(table(), 200, 6, 3);

        expect(run.setsPerSheet).toBe(2);
        expect(run.sheets).toBe(100);
        expect(run.tariffSheets).toBe(100);
        expect(run.sheetCost).toBe(55);
        expect(run.perPart).toBeCloseTo(55 / 6, 10);
    });

    it('дробный комплект на листе → округление тиража листов вверх', () => {
        // 2 детали на листе при 3 в коробке → 2/3 комплекта →
        // ceil(200 × 3 / 2) = 300 листов → тариф 300 (7500)
        const run = calcAssemblyRun(table(), 200, 2, 3);

        expect(run.sheets).toBe(300);
        expect(run.tariffSheets).toBe(300);
        expect(run.sheetCost).toBe(25);
        expect(run.perPart).toBe(12.5);
    });

    it('тираж ниже первой ступени берёт первый тариф', () => {
        // 20 коробок → 20 листов → первая ступень 100 (5500) → 55 ₽/лист
        const run = calcAssemblyRun(table(), 20, 3, 3);

        expect(run.sheets).toBe(20);
        expect(run.tariffSheets).toBe(100);
        expect(run.sheetCost).toBe(55);
        expect(run.perPart).toBeCloseTo(55 / 3, 10);
    });

    it('тираж 3000 и выше экстраполируется шагом stepAfter3000', () => {
        const t = table();
        t.steps = [
            { minQty: 100, price: 5500 },
            { minQty: 3000, price: 30000 },
        ];

        // 4000 коробок → 4000 листов → 30000 + 1 × 1500 = 31500 при тарифе 3000
        const run = calcAssemblyRun(t, 4000, 3, 3);

        expect(run.sheets).toBe(4000);
        expect(run.tariffSheets).toBe(3000);
        expect(run.sheetCost).toBeCloseTo(10.5, 10);
        expect(run.perPart).toBeCloseTo(3.5, 10);
    });

    it('точное попадание в ступень не перескакивает на следующую', () => {
        const run = calcAssemblyRun(table(), 300, 3, 3);

        expect(run.sheets).toBe(300);
        expect(run.tariffSheets).toBe(300);
        expect(run.sheetCost).toBe(25);
    });

    it('нулевые и пустые входные данные дают нули', () => {
        expect(calcAssemblyRun(undefined, 200, 3, 3).perPart).toBe(0);
        expect(calcAssemblyRun(table(), 0, 3, 3).perPart).toBe(0);
        expect(calcAssemblyRun(table(), 200, 0, 3).perPart).toBe(0);
        expect(calcAssemblyRun(table(), 200, 3, 0).perPart).toBe(0);
        expect(calcAssemblyRun({ ...table(), steps: [] }, 200, 3, 3).sheets).toBe(0);
    });
});
