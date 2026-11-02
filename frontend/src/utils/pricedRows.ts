// frontend/src/utils/pricedRows.ts
import type { ApiDetail, Extra } from '../types';

/**
 * Деталь влияет на цену, если у неё есть материал, печать, сборка или операции.
 *
 * <p>Строки без вклада (нулевая цена листа и ничего больше) в «Виде расчёта» не
 * показываем: они не участвовали в цифрах, а список от них только длиннее.
 */
export const detailHasPriceEffect = (row: ApiDetail): boolean =>
    row.enabled !== false
    && ((row.sheetPrice ?? 0) > 0
        || row.isPrinted === true
        || row.inAssembly === true
        || Object.values(row.operations ?? {}).some(Boolean));

/** Дополнительная операция влияет на цену, только если она включена и платная. */
export const extraHasPriceEffect = (row: Extra): boolean =>
    row.enabled !== false && (row.cost ?? 0) > 0;

/** Делит строки на влияющие на цену и скрытые, чтобы UI мог показать счётчик. */
export const splitPriced = <T>(
    rows: readonly T[],
    isPriced: (row: T) => boolean,
): { visible: T[]; hidden: number } => {
    const visible = rows.filter(isPriced);
    return { visible, hidden: rows.length - visible.length };
};
