// frontend/src/utils/printCost.spec.ts
import { describe, expect, it } from 'vitest';
import { calcPrintBill, calcPrintPerUnit } from './printCost';
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

describe('calcPrintBill', () => {
    it('берёт первую ступень с minQty >= тиража', () => {
        expect(calcPrintBill(table(), 200)).toEqual({ tariffSheets: 300, bill: 7500 });
        expect(calcPrintBill(table(), 300)).toEqual({ tariffSheets: 300, bill: 7500 });
        expect(calcPrintBill(table(), 301)).toEqual({ tariffSheets: 500, bill: 9000 });
    });

    it('тираж ниже первой ступени оплачивается по первой ступени', () => {
        expect(calcPrintBill(table(), 20)).toEqual({ tariffSheets: 100, bill: 5500 });
    });

    it('от 3000 листов добавляет stepAfter3000 за каждую начатую 1000', () => {
        const t = table();
        t.steps = [
            { minQty: 100, price: 5500 },
            { minQty: 3000, price: 30000 },
        ];

        expect(calcPrintBill(t, 3000)).toEqual({ tariffSheets: 3000, bill: 30000 });
        expect(calcPrintBill(t, 3001)).toEqual({ tariffSheets: 3000, bill: 31500 });
        expect(calcPrintBill(t, 4000)).toEqual({ tariffSheets: 3000, bill: 31500 });
        expect(calcPrintBill(t, 4001)).toEqual({ tariffSheets: 3000, bill: 33000 });
    });

    it('без таблицы или с нулевым тиражом счёт нулевой', () => {
        expect(calcPrintBill(undefined, 200).bill).toBe(0);
        expect(calcPrintBill({ ...table(), steps: [] }, 200).bill).toBe(0);
        expect(calcPrintBill(table(), 0).bill).toBe(0);
    });
});

describe('calcPrintPerUnit', () => {
    it('1 деталь на листе, 200 коробок → 200 листов → 37.5 ₽ за деталь', () => {
        // 200 листов → тариф 300 (7500) → 7500 / 200 / 1 = 37.5
        expect(calcPrintPerUnit(table(), 200, 1)).toBe(37.5);
    });

    it('двойное деление: и на тираж, и на количество на листе', () => {
        // 100 коробок при 2 дет./лист → 50 листов → тариф 100 (5500) →
        // 5500 / 100 / 2 = 27.5 ₽ за деталь
        expect(calcPrintPerUnit(table(), 100, 2)).toBe(27.5);
    });

    it('3 детали на листе → втрое меньше листов и втрое дешевле деталь', () => {
        // ceil(200 / 3) = 67 листов → тариф 100 (5500) →
        // 5500 / 200 / 3 ≈ 9.17 ₽
        expect(calcPrintPerUnit(table(), 200, 3)).toBeCloseTo(5500 / 200 / 3, 10);
    });

    it('тираж ниже первой ступени оплачивается по первой ступени', () => {
        // 20 коробок → 20 листов → тариф 100 (5500) → 275 ₽ за деталь
        expect(calcPrintPerUnit(table(), 20, 1)).toBe(275);
    });

    it('пустое «кол-во на лист» считается как 1 копия', () => {
        expect(calcPrintPerUnit(table(), 200, 0)).toBe(37.5);
        expect(calcPrintPerUnit(table(), 200, -2)).toBe(37.5);
    });

    it('копий на листе больше, чем коробок в тираже → 0', () => {
        expect(calcPrintPerUnit(table(), 5, 10)).toBe(0);
    });

    it('без таблицы или с нулевым тиражом → 0', () => {
        expect(calcPrintPerUnit(undefined, 200, 1)).toBe(0);
        expect(calcPrintPerUnit(table(), 0, 1)).toBe(0);
        expect(calcPrintPerUnit(table(), -200, 1)).toBe(0);
    });
});
