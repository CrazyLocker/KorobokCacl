// frontend/src/utils/sortParts.ts
// Единый порядок деталей внутри конструкции: калькулятор, справочник
// конструкций, экспорт. БД порядок деталей не хранит, поэтому API отдаёт их
// в произвольном порядке, и сортировать нужно на фронте.

/** Минимальный набор полей, нужный для сортировки. */
export interface SortablePart {
    name: string;
}

/**
 * Порядок известных деталей:
 * Дно → Дно+Разделитель → Крышка → Разделитель → Окно → Шубер.
 * Ключи в нижнем регистре: сравнение нормализует имя детали.
 */
const PART_ORDER: Record<string, number> = {
    'дно': 1,
    'дно+разделитель': 2,
    'крышка': 3,
    'разделитель': 4,
    'окно': 5,
    'шубер': 6,
};

/** Неизвестные детали уходят в конец списка. */
const UNKNOWN_RANK = Number.MAX_SAFE_INTEGER;

/**
 * Ключ сравнения: регистр, «ё» и лишние пробелы не должны менять порядок.
 */
function partKey(name: string): string {
    return (name ?? '')
        .trim()
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/\s+/g, ' ');
}

/**
 * Компаратор деталей.
 * 1. Известные — по PART_ORDER.
 * 2. Неизвестные — в конец, между собой по алфавиту.
 * 3. При равном ранге — по имени (localeCompare 'ru').
 */
export function compareParts(a: SortablePart, b: SortablePart): number {
    const rankA = PART_ORDER[partKey(a.name)] ?? UNKNOWN_RANK;
    const rankB = PART_ORDER[partKey(b.name)] ?? UNKNOWN_RANK;

    if (rankA !== rankB) {
        return rankA - rankB;
    }

    return (a.name ?? '').localeCompare(b.name ?? '', 'ru');
}

/**
 * Сортирует копию списка деталей (не мутирует исходный).
 * Подходит и для `Part` (детали конструкции), и для `Detail` (строки расчёта).
 */
export function sortParts<T extends SortablePart>(list: T[]): T[] {
    return [...list].sort(compareParts);
}
