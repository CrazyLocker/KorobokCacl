// frontend/src/utils/calculationTree.ts
import type { CalculationTree, CalculationVersion, CustomerTree } from '../types';

/**
 * Строка дерева «Клиент → Заказ → Расчёт → Версии».
 *
 * <p>Узлы клиента и заказа — только группировка; действия живут на расчёте
 * («Открыть», «Редактировать» свежую ветку, мягко удалить) и на версии
 * (открыть её состояние в «Виде расчёта»).
 */
export interface CalculationTreeRow {
    key: string;
    kind: 'customer' | 'order' | 'calculation' | 'version';
    title: string;
    /** Расчёт: по нему строятся действия и запрос версий. */
    calculation?: CalculationTree;
    /** Версия: по ней открывается «Вид расчёта». */
    version?: CalculationVersion;
    cost?: number | null;
    updatedAt?: string | null;
    children?: CalculationTreeRow[];
}

/** Версия расчёта в дереве: номер, дата и стоимость. */
const versionRow = (version: CalculationVersion): CalculationTreeRow => ({
    key: `version-${version.id}`,
    kind: 'version',
    title: `v${version.version}`,
    version,
    cost: version.totalCost,
    updatedAt: version.updatedAt,
});

/**
 * Собирает дерево строк из ответа `GET /api/calculations/tree`.
 *
 * <p>Версии подставляются из `versionsByCalculation`: они грузятся лениво по
 * раскрытию расчёта, поэтому до первого раскрытия у расчёта нет детей.
 * Расчёты клиента без заказа попадают в отдельную группу «Без заказа».
 */
export const buildCalculationTreeRows = (
    customers: readonly CustomerTree[],
    versionsByCalculation: Record<string, CalculationVersion[]>,
): CalculationTreeRow[] => {
    const calculationRow = (calculation: CalculationTree): CalculationTreeRow => {
        const versions = versionsByCalculation[calculation.id];
        return {
            key: `calculation-${calculation.id}`,
            kind: 'calculation',
            title: calculation.name,
            calculation,
            cost: calculation.totalCost,
            updatedAt: calculation.updatedAt,
            children: versions?.map(versionRow),
        };
    };

    return customers.map((customer) => {
        const orderRows: CalculationTreeRow[] = customer.orders.map((order) => ({
            key: `order-${order.id}`,
            kind: 'order',
            title: `Заказ № ${order.number}`,
            cost: order.totalCost,
            updatedAt: order.orderDate,
            children: order.calculations.map(calculationRow),
        }));

        if (customer.withoutOrder.length > 0) {
            orderRows.push({
                key: `order-none-${customer.id}`,
                kind: 'order',
                title: 'Без заказа',
                cost: customer.withoutOrder.reduce((sum, item) => sum + (item.totalCost ?? 0), 0),
                children: customer.withoutOrder.map(calculationRow),
            });
        }

        return {
            key: `customer-${customer.id}`,
            kind: 'customer',
            title: customer.name,
            children: orderRows,
        };
    });
};
