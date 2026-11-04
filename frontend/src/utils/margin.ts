/**
 * Наценка на сложность коробки.
 *
 * <p>Чётких критериев «сложной» конструкции нет, поэтому для «Кашированной»
 * технолог задаёт наценку руками, а он берёт больше, чем обычные коробки.
 * Для остальных конструкций действует прежнее значение — 30 ₽.
 */

/** Наценка для обычной конструкции, ₽. */
export const DEFAULT_MARGIN = 30;

/** Наценка по умолчанию для сложной конструкции, ₽. */
export const COMPLEX_MARGIN = 200;

/** Признак конструкции, у которой наценка задаётся вручную. */
const COMPLEX_MARKER = 'кашированн';

/**
 * Наценка по умолчанию для конструкции.
 *
 * @param name название конструкции из справочника
 * @returns 200 ₽ для «Кашированной», иначе 30 ₽
 */
export function defaultMarginForConstruction(name: string | null | undefined): number {
    const normalized = (name ?? '').trim().toLowerCase().replace(/ё/g, 'е');
    return normalized.includes(COMPLEX_MARKER) ? COMPLEX_MARGIN : DEFAULT_MARGIN;
}
