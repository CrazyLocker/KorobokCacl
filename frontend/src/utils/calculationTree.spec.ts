// frontend/src/utils/calculationTree.spec.ts
import { describe, expect, it } from 'vitest';
import { buildCalculationTreeRows } from './calculationTree';
import type { CalculationTree, CalculationVersion, CustomerTree, OrderTree } from '../types';

let seq = 0;

const calculation = (patch: Partial<CalculationTree> = {}): CalculationTree => {
    seq += 1;
    return {
        id: patch.id ?? `calc-${seq}`,
        customerId: 'customer-1',
        orderId: null,
        name: `Расчёт ${seq}`,
        managerName: 'Катя',
        version: 1,
        versionCount: 1,
        totalCost: 100,
        updatedAt: '2026-11-01T10:00:00Z',
        latestId: patch.id ?? `calc-${seq}`,
        ...patch,
    };
};

const order = (patch: Partial<OrderTree> = {}): OrderTree => ({
    id: 'order-1',
    number: '2026-001',
    orderDate: '2026-11-01',
    status: 'draft',
    totalCost: 0,
    calculations: [],
    ...patch,
});

const customer = (patch: Partial<CustomerTree> = {}): CustomerTree => ({
    id: 'customer-1',
    name: 'Тавасиева',
    orders: [],
    withoutOrder: [],
    ...patch,
});

const version = (id: string, number: number): CalculationVersion => ({
    id,
    version: number,
    parentId: number > 1 ? `${id}-parent` : null,
    deleted: false,
    name: 'Расчёт',
    clientName: 'Тавасиева',
    managerName: 'Катя',
    status: 'draft',
    totalCost: 50,
    latest: true,
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
});

describe('buildCalculationTreeRows', () => {
    it('строит клиента, заказ и расчёт вложенными строками', () => {
        const calc = calculation({ id: 'calc-1', name: 'Элара 16', version: 3, versionCount: 4 });
        const [row] = buildCalculationTreeRows(
            [customer({ orders: [order({ calculations: [calc] })] })],
            {},
        );

        expect(row.kind).toBe('customer');
        expect(row.title).toBe('Тавасиева');
        expect(row.children).toHaveLength(1);
        expect(row.children?.[0]).toMatchObject({ kind: 'order', title: 'Заказ № 2026-001' });
        expect(row.children?.[0].children?.[0]).toMatchObject({
            kind: 'calculation',
            title: 'Элара 16',
            cost: 100,
        });
    });

    it('без загруженных версий расчёт остаётся листом', () => {
        const [row] = buildCalculationTreeRows(
            [customer({ orders: [order({ calculations: [calculation()] })] })],
            {},
        );

        expect(row.children?.[0].children?.[0].children).toBeUndefined();
    });

    it('подставляет загруженные версии детьми расчёта', () => {
        const calc = calculation({ id: 'calc-1' });
        const rows = buildCalculationTreeRows(
            [customer({ orders: [order({ calculations: [calc] })] })],
            { 'calc-1': [version('v1', 1), version('v2', 2)] },
        );

        const calcRow = rows[0].children?.[0].children?.[0];
        expect(calcRow?.children?.map((child) => child.title)).toEqual(['v1', 'v2']);
        expect(calcRow?.children?.[0]).toMatchObject({ kind: 'version', cost: 50 });
    });

    it('расчёты без заказа собирает в группу «Без заказа» с суммой', () => {
        const rows = buildCalculationTreeRows([
            customer({
                orders: [order()],
                withoutOrder: [
                    calculation({ id: 'c1', totalCost: 10.5 }),
                    calculation({ id: 'c2', totalCost: 4.5 }),
                ],
            }),
        ], {});

        expect(rows[0].children).toHaveLength(2);
        expect(rows[0].children?.[1]).toMatchObject({
            title: 'Без заказа',
            cost: 15,
        });
        expect(rows[0].children?.[1].children).toHaveLength(2);
    });

    it('не добавляет группу «Без заказа», если расчётов без заказа нет', () => {
        const rows = buildCalculationTreeRows([customer({ orders: [order()] })], {});
        expect(rows[0].children?.map((child) => child.title)).toEqual(['Заказ № 2026-001']);
    });

    it('возвращает пустой список для пустого ответа API', () => {
        expect(buildCalculationTreeRows([], {})).toEqual([]);
    });
});
