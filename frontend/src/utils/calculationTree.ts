// frontend/src/utils/calculationTree.ts
import type { CalculationTree, CalculationVersion, CustomerTree, OrderTree } from '../types';
import { buildVersionTree } from './versionTree';
import type { VersionNode } from './versionTree';

/**
 * Строка дерева «Клиент → Заказы и расчёты → Версии».
 *
 * <p>Заказ вырос из конкретной версии, но не забирает расчёт из дерева: у
 * клиента соседствуют заказы и все его живые расчёты. Узлы клиента и заказа —
 * только группировка; действия живут на расчёте («Открыть», «Редактировать»
 * свежую ветку, мягко удалить) и на версии (открыть её состояние в «Виде
 * расчёта», создать из неё заказ).
 */
export interface CalculationTreeRow {
    key: string;
    kind: 'customer' | 'order' | 'calculation' | 'version';
    title: string;
    /** Пояснение под заголовком: «из v3 · Внутренняя вставка». */
    subtitle?: string;
    /** Расчёт: по нему строятся действия и запрос версий. */
    calculation?: CalculationTree;
    /** Заказ: по нему видно, из какой версии он вырос. */
    order?: OrderTree;
    /** Версия: по ней открывается «Вид расчёта» и создаётся заказ. */
    version?: CalculationVersion;
    cost?: number | null;
    /** Цена с НДС для клиента. */
    clientPrice?: number | null;
    /** Тираж, под который посчитана цена. */
    quantity?: number | null;
    updatedAt?: string | null;
    /** Строка помечена удалённой (расчёт целиком или отдельная версия). */
    deleted?: boolean;
    children?: CalculationTreeRow[];
}

/** «из v3 · Элара 16» — откуда вырос заказ. */
const orderSubtitle = (order: OrderTree): string | undefined => {
    if (order.sourceVersion == null) {
        return undefined;
    }

    return order.sourceCalculationName
        ? `из v${order.sourceVersion} · ${order.sourceCalculationName}`
        : `из v${order.sourceVersion}`;
};

/** «заказ № 2026-001» — какие заказы выросли из версии. */
const versionSubtitle = (version: CalculationVersion): string | undefined => {
    if (!version.orders?.length) {
        return undefined;
    }

    return version.orders.map((order) => `заказ № ${order.number}`).join(', ');
};

/**
 * Версия расчёта в дереве: номер, дата и стоимость.
 *
 * <p>Версии вкладываются друг в друга по `parentId`: правка v3 даёт v4 внутри
 * v3, поэтому ветка видна как ветка, а не как плоский список.
 */
const versionRow = (node: VersionNode): CalculationTreeRow => ({
    key: `version-${node.id}`,
    kind: 'version',
    title: `v${node.version}`,
    subtitle: versionSubtitle(node),
    version: node,
    deleted: node.deleted,
    cost: node.totalCost,
    clientPrice: node.clientPrice,
    quantity: node.quantity,
    updatedAt: node.updatedAt,
    children: node.children.length > 0 ? node.children.map(versionRow) : undefined,
});

/**
 * Собирает строки дерева из ответа `GET /api/calculations/tree`.
 *
 * <p>Версии подставляются из `versionsByCalculation`: они грузятся лениво по
 * раскрытию расчёта, поэтому до первого раскрытия у расчёта нет детей.
 */
export const buildCalculationTreeRows = (
    customers: readonly CustomerTree[],
    versionsByCalculation: Record<string, CalculationVersion[]>,
): CalculationTreeRow[] => {
    const calculationRow = (calculation: CalculationTree): CalculationTreeRow => {
        const versions = versionsByCalculation[calculation.id];
        const versionRoots = versions ? buildVersionTree(versions) : [];
        return {
            key: `calculation-${calculation.id}`,
            kind: 'calculation',
            title: calculation.name,
            calculation,
            deleted: calculation.deleted,
            cost: calculation.totalCost,
            clientPrice: calculation.clientPrice,
            quantity: calculation.quantity,
            updatedAt: calculation.updatedAt,
            children: versionRoots.length > 0 ? versionRoots.map(versionRow) : undefined,
        };
    };

    const orderRow = (order: OrderTree): CalculationTreeRow => ({
        key: `order-${order.id}`,
        kind: 'order',
        title: `Заказ № ${order.number}`,
        subtitle: orderSubtitle(order),
        order,
        deleted: order.deleted,
        cost: order.totalCost,
        updatedAt: order.orderDate,
    });

    // Клиент без заказов и расчётов — строка-пустышка: справочник переживает
    // очистку расчётов, и показывать «dsf» с пустой веткой бессмысленно.
    // Такой клиент появится в дереве, когда у него будет первый расчёт.
    const rows = customers
        .map((customer) => ({
            key: `customer-${customer.id}`,
            kind: 'customer' as const,
            title: customer.name,
            // Сначала сделки клиента, под ними — расчёты, из которых растут новые.
            children: [...customer.orders.map(orderRow), ...customer.calculations.map(calculationRow)],
        }))
        .filter((row) => (row.children?.length ?? 0) > 0);

    return rows;
};

/**
 * Ключи всего поддерева строки — в порядке сверху вниз, без самой строки.
 *
 * <p>Нужно спойлеру клиента: раскрытие должно показывать ветку целиком, а не
 * только первый уровень, поэтому в развёрнутые попадают и заказы, и расчёты,
 * и все ветки версий внутри расчётов.
 */
export const collectDescendantKeys = (row: CalculationTreeRow): string[] => {
    const keys: string[] = [];

    const walk = (node: CalculationTreeRow) => {
        node.children?.forEach((child) => {
            keys.push(child.key);
            walk(child);
        });
    };

    walk(row);

    return keys;
};
