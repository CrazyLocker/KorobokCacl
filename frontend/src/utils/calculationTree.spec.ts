// frontend/src/utils/calculationTree.spec.ts
import { describe, expect, it } from 'vitest';
import { buildCalculationTreeRows, collectDescendantKeys } from './calculationTree';
import type { CalculationTree, CalculationVersion, CustomerTree, OrderTree } from '../types';

let seq = 0;

const calculation = (patch: Partial<CalculationTree> = {}): CalculationTree => {
    seq += 1;
    return {
        id: patch.id ?? `calc-${seq}`,
        customerId: 'customer-1',
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
    customerId: 'customer-1',
    number: '2026-001',
    orderDate: '2026-11-01',
    status: 'draft',
    totalCost: 0,
    sourceCalculationId: 'calc-1',
    sourceVersion: 3,
    sourceCalculationName: 'Элара 16',
    sourceCalculationUpdatedAt: '2026-11-01T10:00:00Z',
    sourceCalculationLatestId: 'calc-1',
    ...patch,
});

const customer = (patch: Partial<CustomerTree> = {}): CustomerTree => ({
    id: 'customer-1',
    name: 'Тавасиева',
    orders: [],
    calculations: [],
    ...patch,
});

const version = (id: string, number: number, patch: Partial<CalculationVersion> = {}): CalculationVersion => ({
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
    orders: [],
    createdAt: '2026-11-01T10:00:00Z',
    updatedAt: '2026-11-01T10:00:00Z',
    ...patch,
});

describe('buildCalculationTreeRows', () => {
    it('показывает у клиента заказ и расчёт соседями', () => {
        const calc = calculation({ id: 'calc-1', name: 'Элара 16', version: 3, versionCount: 4 });
        const [row] = buildCalculationTreeRows(
            [customer({ orders: [order()], calculations: [calc] })],
            {},
        );

        expect(row.kind).toBe('customer');
        expect(row.title).toBe('Тавасиева');
        expect(row.children?.map((child) => child.kind)).toEqual(['order', 'calculation']);
        expect(row.children?.[0]).toMatchObject({
            kind: 'order',
            title: 'Заказ № 2026-001',
            subtitle: 'из v3 · Элара 16',
        });
        expect(row.children?.[1]).toMatchObject({
            kind: 'calculation',
            title: 'Элара 16',
            cost: 100,
        });
    });

    it('заказ без источника остаётся без подписи', () => {
        const [row] = buildCalculationTreeRows(
            [customer({ orders: [order({ sourceVersion: null, sourceCalculationName: null })] })],
            {},
        );

        expect(row.children?.[0].subtitle).toBeUndefined();
    });

    it('не дублирует расчёт в заказе: он остаётся среди расчётов клиента', () => {
        const calc = calculation({ id: 'calc-1' });
        const [row] = buildCalculationTreeRows(
            [customer({ orders: [order({ sourceCalculationId: 'calc-1' })], calculations: [calc] })],
            {},
        );

        expect(row.children).toHaveLength(2);
        expect(row.children?.[0].children).toBeUndefined();
        expect(row.children?.[1].children).toBeUndefined();
    });

    it('подставляет загруженные версии детьми расчёта', () => {
        const calc = calculation({ id: 'calc-1' });
        const rows = buildCalculationTreeRows(
            [customer({ calculations: [calc] })],
            { 'calc-1': [version('v1', 1), version('v2', 2)] },
        );

        const calcRow = rows[0].children?.[0];
        expect(calcRow?.children?.map((child) => child.title)).toEqual(['v1', 'v2']);
        expect(calcRow?.children?.[0]).toMatchObject({ kind: 'version', cost: 50 });
    });

    it('подписывает версию заказами, которые из неё выросли', () => {
        const rows = buildCalculationTreeRows(
            [customer({ calculations: [calculation({ id: 'calc-1' })] })],
            {
                'calc-1': [
                    version('v1', 1, { orders: [{ id: 'order-1', number: '2026-001' }] }),
                    version('v2', 2),
                ],
            },
        );

        expect(rows[0].children?.[0].children?.[0].subtitle).toBe('заказ № 2026-001');
        expect(rows[0].children?.[0].children?.[1].subtitle).toBeUndefined();
    });

    it('возвращает пустой список для пустого ответа API', () => {
        expect(buildCalculationTreeRows([], {})).toEqual([]);
    });

    it('вкладывает версии по parentId: правка v1 даёт v2 внутри v1', () => {
        const rows = buildCalculationTreeRows(
            [customer({ calculations: [calculation({ id: 'calc-1' })] })],
            {
                'calc-1': [
                    version('v1', 1),
                    version('v2', 2, { parentId: 'v1' }),
                    version('v3', 2, { parentId: 'v1' }),
                    version('v4', 3, { parentId: 'v2' }),
                ],
            },
        );

        const roots = rows[0].children?.[0].children;
        expect(roots?.map((row) => row.title)).toEqual(['v1']);
        expect(roots?.[0].children?.map((row) => row.version?.id)).toEqual(['v2', 'v3']);
        expect(roots?.[0].children?.[0].children?.map((row) => row.version?.id)).toEqual(['v4']);
    });

    it('помечает удалённые версии и полностью удалённый расчёт', () => {
        const rows = buildCalculationTreeRows(
            [
                customer({
                    id: 'customer-1',
                    calculations: [
                        calculation({ id: 'calc-1' }),
                        calculation({ id: 'calc-2', deleted: true }),
                    ],
                }),
            ],
            {
                'calc-1': [version('v1', 1, { deleted: true })],
                'calc-2': [version('v2', 1, { deleted: true })],
            },
        );

        const [first, second] = rows[0].children ?? [];
        expect(first.deleted).toBeUndefined();
        expect(first.children?.[0].deleted).toBe(true);
        expect(second.deleted).toBe(true);
    });

    it('скрывает клиента, у которого нет ни заказов, ни расчётов', () => {
        const rows = buildCalculationTreeRows(
            [
                customer({ id: 'empty', name: 'dsf', orders: [], calculations: [] }),
                customer({ id: 'busy', name: 'Лютик', calculations: [calculation({ id: 'calc-1' })] }),
            ],
            {},
        );

        expect(rows.map((row) => row.title)).toEqual(['Лютик']);
    });
});

describe('collectDescendantKeys', () => {
    it('собирает заказы, расчёты и все ветки версий', () => {
        const rows = buildCalculationTreeRows(
            [
                customer({
                    id: 'customer-1',
                    orders: [order()],
                    calculations: [calculation({ id: 'calc-1' })],
                }),
            ],
            {
                'calc-1': [
                    version('v1', 1),
                    version('v2', 2, { parentId: 'v1' }),
                    version('v3', 3, { parentId: 'v2' }),
                ],
            },
        );

        expect(collectDescendantKeys(rows[0])).toEqual([
            'order-order-1',
            'calculation-calc-1',
            'version-v1',
            'version-v2',
            'version-v3',
        ]);
    });

    it('не включает ключ самой строки и пуст у листа', () => {
        const [customerRow] = buildCalculationTreeRows([customer({ id: 'c1', orders: [order()] })], {});

        expect(collectDescendantKeys(customerRow)).toEqual(['order-order-1']);
        expect(collectDescendantKeys(customerRow.children![0])).toEqual([]);
    });
    it('переносит пометку удаления заказа в строку дерева', () => {
        const [customerRow] = buildCalculationTreeRows(
            [customer({ orders: [order({ deleted: true })], calculations: [] })],
            {},
        );

        expect(customerRow.children![0].deleted).toBe(true);
    });
});