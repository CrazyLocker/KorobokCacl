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
    it('200 комплектов, Дно×3 и Крышка×1 → 200 листов, 9.375 ₽ за деталь', () => {
        // Листов нужно max(ceil(200/3)=67, ceil(200/1)=200) = 200 → тариф 300
        // (7500). На листе 4 детали: 7500 / 200 / 4 = 9.375 ₽ за деталь.
        const run = calcAssemblyRun(table(), 200, [
            { colsOnSheet: 3 },
            { colsOnSheet: 1 },
        ]);

        expect(run.totalPartsOnSheet).toBe(4);
        expect(run.sheets).toBe(200);
        expect(run.tariffSheets).toBe(300);
        expect(run.bill).toBe(7500);
        expect(run.sheetCost).toBe(37.5);
        expect(run.perPart).toBe(9.375);
    });

    it('100 комплектов, три детали по 1 копии → 100 листов, ≈18.33 ₽ за деталь', () => {
        // 100 листов → тариф 100 (5500) → 55 ₽/лист → 55 / 3 копии.
        const run = calcAssemblyRun(table(), 100, [
            { colsOnSheet: 1 },
            { colsOnSheet: 1 },
            { colsOnSheet: 1 },
        ]);

        expect(run.totalPartsOnSheet).toBe(3);
        expect(run.sheets).toBe(100);
        expect(run.tariffSheets).toBe(100);
        expect(run.bill).toBe(5500);
        expect(run.sheetCost).toBe(55);
        expect(run.perPart).toBeCloseTo(55 / 3, 10);
    });

    it('100 комплектов, одна деталь по 1 копии → 55 ₽ за деталь', () => {
        const run = calcAssemblyRun(table(), 100, [{ colsOnSheet: 1 }]);

        expect(run.totalPartsOnSheet).toBe(1);
        expect(run.sheets).toBe(100);
        expect(run.bill).toBe(5500);
        expect(run.perPart).toBe(55);
    });

    it('200 комплектов, одна деталь по 3 копии → 67 листов, ≈27.36 ₽ за копию', () => {
        // ceil(200/3) = 67 листов → тариф 100 (5500) → 5500/67/3.
        const run = calcAssemblyRun(table(), 200, [{ colsOnSheet: 3 }]);

        expect(run.totalPartsOnSheet).toBe(3);
        expect(run.sheets).toBe(67);
        expect(run.tariffSheets).toBe(100);
        expect(run.sheetCost).toBeCloseTo(5500 / 67, 10);
        expect(run.perPart).toBeCloseTo(5500 / 67 / 3, 10);
    });

    it('тираж листов берёт максимум по деталям, а не по их сумме', () => {
        // Дно×3 и Крышка×2: ceil(200/3)=67, ceil(200/2)=100 → 100 листов.
        const run = calcAssemblyRun(table(), 200, [
            { colsOnSheet: 3 },
            { colsOnSheet: 2 },
        ]);

        expect(run.totalPartsOnSheet).toBe(5);
        expect(run.sheets).toBe(100);
        expect(run.tariffSheets).toBe(100);
        expect(run.perPart).toBeCloseTo(5500 / 100 / 5, 10);
    });

    it('тираж ниже первой ступени берёт первый тариф', () => {
        // 20 комплектов → 20 листов → первая ступень 100 (5500) → 275 ₽/лист.
        const run = calcAssemblyRun(table(), 20, [{ colsOnSheet: 1 }]);

        expect(run.sheets).toBe(20);
        expect(run.tariffSheets).toBe(100);
        expect(run.sheetCost).toBe(275);
        expect(run.perPart).toBe(275);
    });

    it('тираж 3000 и выше экстраполируется шагом stepAfter3000', () => {
        const t = table();
        t.steps = [
            { minQty: 100, price: 5500 },
            { minQty: 3000, price: 30000 },
        ];

        // 4000 комплектов → 4000 листов → 30000 + 1 × 1500 = 31500 при тарифе 3000.
        const run = calcAssemblyRun(t, 4000, [{ colsOnSheet: 1 }]);

        expect(run.sheets).toBe(4000);
        expect(run.tariffSheets).toBe(3000);
        expect(run.sheetCost).toBeCloseTo(7.875, 10);
        expect(run.perPart).toBeCloseTo(7.875, 10);
    });

    it('точное попадание в ступень не перескакивает на следующую', () => {
        const run = calcAssemblyRun(table(), 300, [{ colsOnSheet: 1 }]);

        expect(run.sheets).toBe(300);
        expect(run.tariffSheets).toBe(300);
        expect(run.sheetCost).toBe(25);
        expect(run.perPart).toBe(25);
    });

    it('пустое «кол-во на лист» считается как 1 копия', () => {
        expect(calcAssemblyRun(table(), 200, [{ colsOnSheet: undefined }]).perPart).toBe(37.5);
        expect(calcAssemblyRun(table(), 200, [{ colsOnSheet: null }]).perPart).toBe(37.5);
    });

    it('нулевое и отрицательное «кол-во на лист» деталь не помещает на лист', () => {
        // Явной ошибки ввода здесь не показываем: бэкенд отклоняет такой запрос.
        expect(calcAssemblyRun(table(), 100, [{ colsOnSheet: 0 }]).sheets).toBe(0);
        expect(calcAssemblyRun(table(), 100, [{ colsOnSheet: -2 }]).sheets).toBe(0);

        const mixed = calcAssemblyRun(table(), 100, [
            { colsOnSheet: 0 },
            { colsOnSheet: 1 },
        ]);
        expect(mixed.totalPartsOnSheet).toBe(1);
        expect(mixed.perPart).toBe(55);
    });

    it('нулевые и пустые входные данные дают нули', () => {
        expect(calcAssemblyRun(undefined, 200, [{ colsOnSheet: 1 }]).perPart).toBe(0);
        expect(calcAssemblyRun(table(), 0, [{ colsOnSheet: 1 }]).perPart).toBe(0);
        expect(calcAssemblyRun(table(), -200, [{ colsOnSheet: 1 }]).perPart).toBe(0);
        expect(calcAssemblyRun({ ...table(), steps: [] }, 200, [{ colsOnSheet: 1 }]).sheets).toBe(0);
        expect(calcAssemblyRun(table(), 200, []).sheets).toBe(0);
    });
});

