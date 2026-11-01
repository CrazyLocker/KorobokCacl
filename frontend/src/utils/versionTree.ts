// frontend/src/utils/versionTree.ts
import type { CalculationVersion } from '../types';

/** Версия дерева с вложенными подветками. */
export interface VersionNode extends CalculationVersion {
    /** Версии, сделанные из этой; у конца ветки — пусто. */
    children: VersionNode[];
}

/**
 * Собирает плоский список версий (как отдаёт `GET /calculations/{id}/versions`)
 * в дерево по `parentId`.
 *
 * <p>Порядок внутри одного уровня — по номеру версии: у двух веток от одной
 * версии номера совпадают, поэтому вторая сортировка по `createdAt` держит
 * порядок стабильным. Версия с неизвестным родителем становится корнем, чтобы
 * история не терялась при неполной выдаче.
 */
export const buildVersionTree = (versions: readonly CalculationVersion[]): VersionNode[] => {
    const nodes = new Map<string, VersionNode>();
    versions.forEach((version) => nodes.set(version.id, { ...version, children: [] }));

    const roots: VersionNode[] = [];
    versions.forEach((version) => {
        const node = nodes.get(version.id);
        if (!node) return;
        const parent = version.parentId ? nodes.get(version.parentId) : undefined;
        if (parent) parent.children.push(node);
        else roots.push(node);
    });

    const sortLevel = (level: VersionNode[]) => {
        level.sort((left, right) => (
            left.version !== right.version
                ? left.version - right.version
                : left.createdAt.localeCompare(right.createdAt)
        ));
        level.forEach((node) => sortLevel(node.children));
    };
    sortLevel(roots);

    return roots;
};
