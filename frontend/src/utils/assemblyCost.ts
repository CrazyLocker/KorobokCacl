// frontend/src/utils/assemblyCost.ts
import type { PrintTable } from '../types';
import { calcPrintBill } from './printCost';

/**
 * Расчёт режима «Сборка на печатный лист» для комплекта деталей.
 *
 * Один лист несёт комплект: деталь с `colsOnSheet = 3` лежит на каждом листе
 * трижды. Прогон должен напечатать листов не меньше, чем нужно любой детали,
 * поэтому тираж листов задаёт деталь, которой нужно больше всего листов:
 *
 *   totalPartsOnSheet = Σ colsOnSheet_j
 *   sheets            = max(ceil(quantity / colsOnSheet_j))
 *   bill              = calcPrintBill(table, sheets)
 *   sheetCost         = bill / sheets
 *   perPart           = sheetCost / totalPartsOnSheet
 *
 * `perPart` одинаков для всех деталей комплекта: счёт за лист делят все копии
 * на этом листе. `quantity` — тираж каждой детали (1 коробка = 1 комплект).
 *
 * Деталь с `colsOnSheet < 1` не помещается на лист и здесь пропускается;
 * бэкенд отклоняет такой запрос ошибкой валидации, поэтому молчаливый пропуск
 * в API не скрывает ошибку пользователя.
 *
 * ВАЖНО: формула дублирует бэкенд (PrintCostCalculator.calcAssemblyRun) —
 * менять обе реализации вместе.
 */
export interface AssemblyDetailInput {
    // Сколько копий детали лежит на листе сборки; null/undefined = 1.
    colsOnSheet?: number | null;
}

export interface AssemblyRun {
    /** Сумма копий всех деталей на одном листе. */
    totalPartsOnSheet: number;
    /** Тираж листов прогона: max(ceil(quantity / colsOnSheet)). */
    sheets: number;
    /** Тираж ступени, по которой взят тариф (300 при 200 листах). */
    tariffSheets: number;
    /** Счёт типографии за тираж, ₽. */
    bill: number;
    /** Стоимость одного напечатанного листа: bill / sheets. */
    sheetCost: number;
    /** Себестоимость печати одной копии любой детали комплекта. */
    perPart: number;
}

const emptyRun = (): AssemblyRun => ({
    totalPartsOnSheet: 0,
    sheets: 0,
    tariffSheets: 0,
    bill: 0,
    sheetCost: 0,
    perPart: 0,
});

/** Копий на листе: null/undefined = 1, нечисловое значение = 0 (пропуск). */
const resolvedCols = (value: number | null | undefined): number => {
    if (value == null) return 1;
    return Number.isFinite(value) ? Math.floor(value) : 0;
};

export const calcAssemblyRun = (
    table: PrintTable | undefined,
    quantity: number,
    details: readonly AssemblyDetailInput[],
): AssemblyRun => {
    if (!table || !table.steps?.length) return emptyRun();
    if (!(quantity > 0) || !Number.isFinite(quantity)) return emptyRun();

    const cols = details
        .map((detail) => resolvedCols(detail?.colsOnSheet))
        .filter((value) => value > 0);
    if (!cols.length) return emptyRun();

    const totalPartsOnSheet = cols.reduce((sum, value) => sum + value, 0);
    const sheets = cols.reduce(
        (max, value) => Math.max(max, Math.ceil(quantity / value)),
        0,
    );
    if (!(sheets > 0)) return emptyRun();

    const { tariffSheets, bill } = calcPrintBill(table, sheets);
    if (!(bill > 0)) return emptyRun();

    const sheetCost = bill / sheets;
    return {
        totalPartsOnSheet,
        sheets,
        tariffSheets,
        bill,
        sheetCost,
        perPart: sheetCost / totalPartsOnSheet,
    };
};

