// frontend/src/utils/sortConstructs.ts
// UI-сортировка справочника конструкций: сначала по классу (заданный порядок),
// внутри класса — по численности (размерности), а не по строке. Поэтому
// «Этне 10» не встаёт между «Этне 1» и «Этне 2».

/** Минимальный набор полей, нужный для сортировки. */
export interface SortableConstruct {
    name: string;
    /** constructs.type из БД (ELARA / PALLENA / …) — если заполнен, приоритетнее имени. */
    type?: string;
}

/**
 * Порядок классов конструкций для UI.
 * Сначала по классу (в заданном порядке), внутри класса — по числу (размерности).
 * Неизвестные классы — в конец, по алфавиту.
 * Ранги — обычные ординалы 1..N: «Индивидуальная» и «Кашированная» стоят первыми,
 * поэтому первая конструкция списка (= дефолт в калькуляторе) — «Индивидуальная».
 */
const CLASS_ORDER: Record<string, number> = {
    'Индивидуальная': 1,
    'Кашированная': 2,
    'Элара': 3,
    'Паллена': 4,
    'Этне': 5,
    'Гималия': 6,
    'Эгеон': 7,
    'Нереида': 8,
    'Атлас': 9,
    'Тестовая': 10,
};

/**
 * Код класса из БД (constructs.type) → имя класса в UI.
 * INDIVIDUAL и LAMINATED входят: это отдельные классы справочника (V16), они стоят
 * в CLASS_ORDER первыми. CUSTOM сюда не входит намеренно: у тестовых конструкций
 * класс берётся из имени, а CUSTOM-конструкция с произвольным именем попадает
 * в «неизвестные».
 */
const TYPE_TO_CLASS: Record<string, string> = {
    INDIVIDUAL: 'Индивидуальная',
    LAMINATED: 'Кашированная',
    ELARA: 'Элара',
    PALLENA: 'Паллена',
    ETNE: 'Этне',
    HIMALAYA: 'Гималия',
    EGEON: 'Эгеон',
    NEREIDA: 'Нереида',
    ATLAS: 'Атлас',
};

/** Класс для неизвестных имён: уходит в конец списка. */
const UNKNOWN_RANK = Number.MAX_SAFE_INTEGER;

/**
 * Извлекает класс и размерность из имени конструкции.
 * Примеры: «Элара 4» → {className:'Элара', size:4};
 *          «Этне 10 (шубер)» → {className:'Этне', size:10};
 *          «Тестовая» → {className:'Тестовая', size:null}.
 */
export function parseConstructName(name: string): { className: string; size: number | null } {
    const trimmed = (name ?? '').trim();
    if (!trimmed) {
        return { className: '', size: null };
    }

    const [first, ...rest] = trimmed.split(/\s+/);
    // Первое число после класса: у «Этне 10 (шубер)» это 10, суффикс не мешает.
    const sizeMatch = rest.join(' ').match(/\d+/);

    return {
        className: first,
        size: sizeMatch ? Number(sizeMatch[0]) : null,
    };
}

/** Класс конструкции: сначала type из БД, затем первый токен имени. */
function resolveClassName(construct: SortableConstruct): string {
    const byType = construct.type ? TYPE_TO_CLASS[construct.type.toUpperCase()] : undefined;
    return byType ?? parseConstructName(construct.name).className;
}

/**
 * Компаратор для списка конструкций.
 * 1. Класс по CLASS_ORDER; неизвестные — в конец (между собой по алфавиту).
 * 2. Внутри класса — по размерности (без размерности — в конец).
 * 3. При равных размерностях — по имени (localeCompare 'ru').
 */
export function compareConstructs(a: SortableConstruct, b: SortableConstruct): number {
    const classA = resolveClassName(a);
    const classB = resolveClassName(b);
    const rankA = CLASS_ORDER[classA] ?? UNKNOWN_RANK;
    const rankB = CLASS_ORDER[classB] ?? UNKNOWN_RANK;

    if (rankA !== rankB) {
        return rankA - rankB;
    }
    if (rankA === UNKNOWN_RANK) {
        const byClass = classA.localeCompare(classB, 'ru');
        if (byClass !== 0) return byClass;
    }

    const { size: sizeA } = parseConstructName(a.name);
    const { size: sizeB } = parseConstructName(b.name);

    if (sizeA === null && sizeB !== null) return 1;
    if (sizeA !== null && sizeB === null) return -1;
    if (sizeA !== null && sizeB !== null && sizeA !== sizeB) return sizeA - sizeB;

    return a.name.localeCompare(b.name, 'ru');
}

/**
 * Сортирует копию списка конструкций (не мутирует исходный).
 */
export function sortConstructs<T extends SortableConstruct>(list: T[]): T[] {
    return [...list].sort(compareConstructs);
}
