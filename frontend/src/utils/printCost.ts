// frontend/src/utils/printCost.ts
import type { PrintTable } from '../types';

/**
 * Тариф печати, выбранный для тиража листов.
 */
export interface PrintBill {
    /** Тираж ступени, по которой взят тариф (при экстраполяции — последняя ступень). */
    tariffSheets: number;
    /** Счёт типографии за тираж, ₽ (без НДС). */
    bill: number;
}

/**
 * Счёт типографии за тираж печатных листов (без НДС).
 *
 * Логика 1:1 с прототипом (calcPrintCost) и бэкендом
 * (PrintCostCalculator.calcPrintCost):
 *   - тираж меньше первой ступени → цена первой ступени;
 *   - иначе — первая ступень с minQty >= тираж;
 *   - от 3000 листов — цена последней ступени + stepAfter3000 за каждую
 *     начатую 1000 листов.
 *
 * @returns счёт и тираж ступени; нули, если таблицы нет или тираж <= 0
 */
export const calcPrintBill = (table: PrintTable | undefined, sheets: number): PrintBill => {
    if (!table || !table.steps?.length || !(sheets > 0)) {
        return { tariffSheets: 0, bill: 0 };
    }

    const steps = table.steps;
    const lastStep = steps[steps.length - 1];
    if (sheets >= 3000) {
        const extra = Math.ceil((sheets - 3000) / 1000) * (table.stepAfter3000 || 0);
        return { tariffSheets: lastStep.minQty, bill: lastStep.price + extra };
    }

    const step = steps.find((item) => item.minQty >= sheets) ?? steps[0];
    return { tariffSheets: step.minQty, bill: step.price };
};

/**
 * Стоимость печати одной детали без НДС в обычном режиме печати
 * (не «Сборка на печатный лист»), раскиданная на тираж деталей.
 *
 *   sheets  = ceil(quantity / partsPerSheet)
 *   bill    = calcPrintBill(table, sheets).bill
 *   perUnit = (bill / quantity) / partsPerSheet
 *
 * Двойное деление (и на тираж, и на количество на листе) — осознанное решение
 * заказчика из прототипа, а не ошибка: при 100 деталях и 2 дет./лист счёт
 * 5500 даёт 27.50 ₽ на деталь.
 *
 * Копий на листе больше, чем деталей в тираже → 0: такой расклад прототип
 * помечает ошибкой (validatePrint) и блокирует расчёт.
 */
export const calcPrintPerUnit = (
    table: PrintTable | undefined,
    quantity: number,
    partsPerSheet: number,
): number => {
    if (!(quantity > 0)) return 0;

    const perSheet = partsPerSheet > 0 ? partsPerSheet : 1;
    if (perSheet > quantity) return 0;

    const sheets = Math.ceil(quantity / perSheet);
    const { bill } = calcPrintBill(table, sheets);

    return bill > 0 ? bill / quantity / perSheet : 0;
};
