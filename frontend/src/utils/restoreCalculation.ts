// frontend/src/utils/restoreCalculation.ts
import type { ApiDetail, CalculationRequest, Detail } from '../types';
import { createDetailUiKey } from './calculationRequest';

/** Query-параметр, которым калькулятор открывает сохранённый расчёт на правку. */
export const CALCULATION_ID_PARAM = 'calculationId';

/**
 * Идентификатор расчёта из адресной строки.
 *
 * <p>Правка открывается отдельной загрузкой страницы (`?calculationId=…`),
 * поэтому источник истины — URL, а не состояние React: ссылку можно
 * переслать и обновить без потери контекста.
 *
 * @param search строка запроса, по умолчанию текущая адресная строка
 * @returns идентификатор расчёта или null, если параметра нет
 */
export const readCalculationIdFromLocation = (search?: string): string | null => {
    const query = search ?? (typeof window === 'undefined' ? '' : window.location.search);
    const value = new URLSearchParams(query).get(CALCULATION_ID_PARAM);
    const trimmed = value?.trim() ?? '';
    return trimmed === '' ? null : trimmed;
};

/**
 * Строки деталей калькулятора из сохранённого запроса.
 *
 * <p>Сохранённому расчёту не нужен справочник конструкций: детали берутся
 * из state как есть (историческая точность), uiKey выдаётся заново, а
 * необязательные поля получают безопасные значения — старые сохранения
 * могут не содержать режима сборки и количества копий на листе.
 *
 * @param details детали сохранённого запроса
 * @returns детали в форме состояния калькулятора
 */
export const buildDetailRows = (details: readonly ApiDetail[]): Detail[] =>
    details.map((detail) => ({
        ...detail,
        uiKey: createDetailUiKey(),
        partsPerSheetOnPrint: detail.partsPerSheetOnPrint ?? 1,
        inAssembly: detail.inAssembly ?? false,
        colsOnSheet: (detail.colsOnSheet ?? 0) > 0 ? detail.colsOnSheet : 1,
    }));

/**
 * Проверяет, что сохранённый расчёт можно открыть в калькуляторе.
 *
 * <p>Нормализатор бросает Error на пустых данных; здесь нужен только факт
 * «пригоден / нет», чтобы показать пользователю причину, а не пустой экран.
 *
 * @param request нормализованный запрос
 * @returns true, если есть что восстанавливать
 */
export const isRestorableRequest = (request: CalculationRequest | null): boolean =>
    request !== null
    && request.construction.trim() !== ''
    && request.details.length > 0;
