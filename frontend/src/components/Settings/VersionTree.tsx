// frontend/src/components/Settings/VersionTree.tsx
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Flex, Tag, Tree } from 'antd';
import type { DataNode } from 'antd/es/tree';
import type { CalculationVersion } from '../../types';
import { buildVersionTree } from '../../utils/versionTree';
import type { VersionNode } from '../../utils/versionTree';

interface Props {
    /** Плоский список версий дерева (как отдаёт `GET /calculations/{id}/versions`). */
    versions: readonly CalculationVersion[];
    /** Подсвеченная версия; null — ничего не выбрано. */
    selectedId: string | null;
    /** Клик по версии. */
    onSelect: (id: string) => void;
}

const MUTED = { color: '#8c8c8c', fontSize: 12 } as const;

const money = (value: number | null): string => (
    value === null || value === undefined
        ? '—'
        : `${value.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`
);

const formatDate = (value: string): string => {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('ru-RU');
};

/**
 * Метка о заказе рядом с версией, которая его изменила: «в заказе № …» —
 * версия завела расчёт в заказ, «без заказа» — вывела из него.
 */
const orderTag = (node: VersionNode, parentOrderId: string | null): ReactNode => {
    if (node.orderId === parentOrderId) return null;
    if (!node.orderId) {
        return <Tag style={{ marginInlineEnd: 0 }}>без заказа</Tag>;
    }
    return (
        <Tag color="blue" style={{ marginInlineEnd: 0 }}>
            {node.orderNumber ? `в заказе № ${node.orderNumber}` : 'в заказе'}
        </Tag>
    );
};

/** Заголовок узла: номер, время правки, менеджер, себестоимость, заказ. */
const versionTitle = (node: VersionNode, parentOrderId: string | null): ReactNode => (
    <Flex
        gap={10}
        align="center"
        style={{
            textDecoration: node.deleted ? 'line-through' : undefined,
            opacity: node.deleted ? 0.6 : undefined,
        }}
    >
        <span style={{ minWidth: 34, fontWeight: 500 }}>v{node.version}</span>
        <span style={MUTED}>{formatDate(node.updatedAt)}</span>
        <span>{node.managerName || '—'}</span>
        <span style={{ minWidth: 96, textAlign: 'right' }}>{money(node.totalCost)}</span>
        {orderTag(node, parentOrderId)}
        {node.deleted && <Tag color="red" style={{ marginInlineEnd: 0 }}>удалена</Tag>}
        {!node.deleted && node.children.length === 0 && (
            <Tag color="green" style={{ marginInlineEnd: 0 }}>конец ветки</Tag>
        )}
    </Flex>
);

const toTreeNode = (node: VersionNode, parentOrderId: string | null): DataNode => ({
    key: node.id,
    title: versionTitle(node, parentOrderId),
    children: node.children.map((child) => toTreeNode(child, node.orderId ?? null)),
});

/**
 * Дерево версий расчёта: ветки раскрыты спойлерами, клик по узлу выбирает
 * версию. Удалённые версии остаются зачёркнутыми — история нужна при
 * согласовании с заказчиком.
 */
export const VersionTree = ({ versions, selectedId, onSelect }: Props) => {
    const [expandedKeys, setExpandedKeys] = useState<string[]>(() => versions.map((version) => version.id));

    // Новые версии (после сохранения или удаления) раскрываем, ручной выбор не сбрасываем.
    useEffect(() => {
        setExpandedKeys((previous) => {
            const known = new Set(previous);
            const added = versions.map((version) => version.id).filter((id) => !known.has(id));
            return added.length > 0 ? [...previous, ...added] : previous;
        });
    }, [versions]);

    const treeData = useMemo(
        () => buildVersionTree(versions).map((node) => toTreeNode(node, null)),
        [versions],
    );

    return (
        <Tree
            blockNode
            selectable
            treeData={treeData}
            expandedKeys={expandedKeys}
            selectedKeys={selectedId ? [selectedId] : []}
            onExpand={(keys) => setExpandedKeys(keys.map(String))}
            onSelect={(keys) => {
                const next = keys[0];
                if (typeof next === 'string') onSelect(next);
            }}
        />
    );
};
