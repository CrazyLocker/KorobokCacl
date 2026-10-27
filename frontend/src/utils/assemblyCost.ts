// frontend/src/utils/assemblyCost.ts
import type { PrintTable } from '../types';

/**
 * Расчёт режима «Сборка на печатный лист».
 *
 * Аксиома заказчика: 1 коробка = 1 комплект деталей (дно + разделитель + крышка …),
 * поэтому тираж каждой детали равен тиражу коробок.
 *
 *   setsPerSheet  = partsOnSheet / partsInBox      (сколько комплектов на листе)
 *   sheets        = ceil(boxQuantity / setsPerSheet)
 *   tariff        = ближайшая ступень print_tables с minQty >= sheets
 *   bill          = цена выбранной ступени
 *   sheetCost     = bill / tariffSheets            (цена листа по тарифу)
 *   perPart       = sheetCost / partsOnSheet       (себестоимость печати детали)
 *
 * Пример: 200 коробок, лист = 1 дно + 1 разделитель + 1 крышка (3 детали при
 * 3 деталях в коробке) → 200 листов → тариф 300 за 7500 → 25 ₽ за лист →
 * 8.33 ₽ за деталь → 25 ₽ за коробку.
 *
 * ВАЖНО: формула дублирует бэкенд (PrintCostCalculator.calcAssemblyRun) —
 * менять обе реализации вместе.
 */
export interface AssemblyRun {
    /** Всего деталей на листе сборки (сумма «кол-во на лист»). */
    partsOnSheet: number;
    /** Деталей в одной коробке (комплект). */
    partsInBox: number;
    /** Сколько комплектов несёт один лист. */
    setsPerSheet: number;
    /** Тираж листов. */
    sheets: number;
    /** Тираж ступени, по которой взят тариф (300 при 200 листах). */
    tariffSheets: number;
    /** Стоимость одного листа. */
    sheetCost: number;
    /** Себестоимость печати одной детали. */
    perPart: number;
}

const emptyRun = (): AssemblyRun => ({
    partsOnSheet: 0,
    partsInBox: 0,
    setsPerSheet: 0,
    sheets: 0,
    tariffSheets: 0,
    sheetCost: 0,
    perPart: 0,
});

export const calcAssemblyRun = (
    table: PrintTable | undefined,
    boxQuantity: number,
    partsOnSheet: number,
    partsInBox: number,
): AssemblyRun => {
    if (!table || !table.steps?.length) return emptyRun();
    if (!(boxQuantity > 0) || !(partsOnSheet > 0) || !(partsInBox > 0)) return emptyRun();

    // sheets = ceil(boxQuantity / (partsOnSheet / partsInBox)); делим целые
    // числа, чтобы не ловить погрешность float на дробных комплектах.
    const sheets = Math.ceil((boxQuantity * partsInBox) / partsOnSheet);

    const steps = table.steps;
    const lastStep = steps[steps.length - 1];
    let bill: number;
    let tariffSheets: number;
    if (sheets >= 3000) {
        // Как в calcPrintCost: экстраполяция от последней ступени шагом 1000.
        const extra = Math.ceil((sheets - 3000) / 1000) * (table.stepAfter3000 || 0);
        bill = lastStep.price + extra;
        tariffSheets = lastStep.minQty;
    } else {
        const step = steps.find((item) => item.minQty >= sheets) ?? steps[0];
        bill = step.price;
        tariffSheets = step.minQty;
    }

    const sheetCost = tariffSheets > 0 ? bill / tariffSheets : 0;

    return {
        partsOnSheet,
        partsInBox,
        setsPerSheet: partsOnSheet / partsInBox,
        sheets,
        tariffSheets,
        sheetCost,
        perPart: sheetCost / partsOnSheet,
    };
};
