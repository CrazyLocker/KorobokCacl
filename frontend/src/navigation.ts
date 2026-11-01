// frontend/src/navigation.ts
// Единый список страниц, URL и пунктов меню. Используется App и Ant Design shell.

export type PageType =
    | 'calculator'
    | 'knife'
    | 'layout'
    | 'cliche'
    | 'congrev'
    | 'silkscreen'
    | 'calculations'
    | 'references'
    | 'settings';

/** URL path of every page, so direct links like /layout keep working. */
export const PAGE_PATHS: Record<PageType, string> = {
    calculator: '/',
    knife: '/knife',
    layout: '/layout',
    cliche: '/cliche',
    congrev: '/congrev',
    silkscreen: '/silkscreen',
    calculations: '/calculations',
    references: '/references',
    settings: '/settings',
};

export interface NavItem {
    key: PageType;
    label: string;
    dev?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
    { key: 'calculator', label: 'Расчет коробки' },
    { key: 'calculations', label: 'Сохранённые расчёты' },
    { key: 'layout', label: 'Раскладка' },
    { key: 'knife', label: 'Расчет ножа' },
    { key: 'cliche', label: 'Расчет клише', dev: true },
    { key: 'congrev', label: 'Расчет конгрев', dev: true },
    { key: 'silkscreen', label: 'Расчет шелкография', dev: true },
    { key: 'references', label: 'Справочники' },
    { key: 'settings', label: 'Настройки' },
];

/** Page for the current URL; unknown paths fall back to the calculator. */
export const pageFromPath = (pathname: string): PageType => {
    const normalized = pathname.replace(/\/+$/, '') || '/';
    const entry = (Object.entries(PAGE_PATHS) as Array<[PageType, string]>)
        .find(([, path]) => path === normalized);
    return entry ? entry[0] : 'calculator';
};

/** URL калькулятора, открывающего сохранённый расчёт на правку. */
export const calculationEditorPath = (id: string): string =>
    `${PAGE_PATHS.calculator}?calculationId=${encodeURIComponent(id)}`;

/**
 * Переход к правке сохранённого расчёта.
 *
 * <p>Калькулятор восстанавливает state из URL при загрузке, поэтому здесь
 * именно переход по адресу, а не pushState: страница должна перечитаться,
 * иначе текущий расчёт остался бы в памяти и спорил с восстановленным.
 */
export const openCalculationEditor = (id: string): void => {
    window.location.assign(calculationEditorPath(id));
};
