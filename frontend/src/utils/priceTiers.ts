import type { CalculationRequest } from '../types';

/** Границы тиража, вычитанные из подписи тира. */
export interface TierRange {
    /** Нижняя граница включительно; у тира «до 9» это 1. */
    min: number;
    /** Верхняя граница включительно; null у последнего тира «от 1500». */
    max: number | null;
}

/**
 * Читает границы тиража из подписи, которую присылает бэкенд
 * (`до 9`, `10–49`, `от 1500`).
 *
 * <p>Подпись приходит из настроек `app.pricing.discount-steps`, поэтому
 * границы восстанавливаются из текста, а не дублируются константами: если
 * в конфигурации появятся другие тиры, подсветка либо сработает по ним,
 * либо просто не покажется.
 *
 * @param label подпись тира как её видит пользователь
 * @returns границы тира или null, если подпись не распознана
 */
export function parseTierLabel(label: string): TierRange | null {
    const text = label.trim().replace(/\s+/g, ' ');

    const upTo = /^до\s+(\d+)$/.exec(text);
    if (upTo) {
        return { min: 1, max: Number(upTo[1]) };
    }

    const from = /^от\s+(\d+)$/.exec(text);
    if (from) {
        return { min: Number(from[1]), max: null };
    }

    const range = /^(\d+)\s*[–—-]\s*(\d+)$/.exec(text);
    if (range) {
        return { min: Number(range[1]), max: Number(range[2]) };
    }

    return null;
}

/**
 * Тираж, по которому считается цена коробки: печать, если она включена,
 * иначе сборка. Ровно этот тираж показывает карточка «Цены по тиражам».
 *
 * @param request сохранённый запрос расчёта
 * @returns тираж или null, когда режим не включён либо тираж не задан
 */
export function pricedQuantity(request: CalculationRequest | null): number | null {
    if (!request) {
        return null;
    }

    const print = request.printSettings;
    if (print?.enabled && typeof print.quantity === 'number' && print.quantity > 0) {
        return print.quantity;
    }

    const assembly = request.assemblySettings;
    if (assembly?.enabled && typeof assembly.quantity === 'number' && assembly.quantity > 0) {
        return assembly.quantity;
    }

    return null;
}

/**
 * Ищет подпись тира, в который попадает тираж расчёта.
 *
 * @param labels подписи тиров в порядке возрастания
 * @param quantity тираж коробки
 * @returns подпись тира или null, если тираж неизвестен либо вне диапазонов
 */
export function tierLabelForQuantity(labels: readonly string[], quantity: number | null): string | null {
    if (quantity == null || quantity <= 0) {
        return null;
    }

    for (const label of labels) {
        const range = parseTierLabel(label);
        if (!range) {
            continue;
        }
        const inRange = quantity >= range.min && (range.max == null || quantity <= range.max);
        if (inRange) {
            return label;
        }
    }

    return null;
}
