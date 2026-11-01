// frontend/src/utils/versionTree.spec.ts
import { describe, expect, it } from 'vitest';
import { buildVersionTree } from './versionTree';
import type { CalculationVersion } from '../types';

let seq = 0;
const version = (patch: Partial<CalculationVersion> = {}): CalculationVersion => {
    seq += 1;
    return {
        id: patch.id ?? `v${seq}`,
        version: 1,
        parentId: null,
        deleted: false,
        name: 'Элара 16',
        clientName: 'Тавасиева',
        managerName: 'Катя',
        status: 'draft',
        totalCost: 100,
        latest: true,
        createdAt: `2026-10-0${Math.min(seq, 9)}T10:00:0${seq % 10}Z`,
        updatedAt: `2026-10-0${Math.min(seq, 9)}T10:00:0${seq % 10}Z`,
        ...patch,
    };
};

describe('buildVersionTree', () => {
    it('складывает линейную историю в цепочку', () => {
        const v1 = version({ id: 'v1', version: 1 });
        const v2 = version({ id: 'v2', version: 2, parentId: 'v1' });
        const v3 = version({ id: 'v3', version: 3, parentId: 'v2' });

        const [root] = buildVersionTree([v3, v1, v2]);

        expect(root.id).toBe('v1');
        expect(root.children.map((node) => node.id)).toEqual(['v2']);
        expect(root.children[0].children.map((node) => node.id)).toEqual(['v3']);
    });

    it('оставляет ветки от одной версии соседями с одинаковым номером', () => {
        const v1 = version({ id: 'v1', version: 1 });
        const v2 = version({ id: 'v2', version: 2, parentId: 'v1' });
        const left = version({ id: 'left', version: 3, parentId: 'v2', createdAt: '2026-10-02T10:00:00Z' });
        const right = version({ id: 'right', version: 3, parentId: 'v2', createdAt: '2026-10-03T10:00:00Z' });

        const [root] = buildVersionTree([right, left, v2, v1]);
        const branch = root.children[0];

        expect(branch.children.map((node) => node.id)).toEqual(['left', 'right']);
        expect(branch.children.map((node) => node.version)).toEqual([3, 3]);
    });

    it('сортирует уровень по номеру версии, а не по порядку выдачи', () => {
        const v1 = version({ id: 'v1', version: 1 });
        const second = version({ id: 'b', version: 2, parentId: 'v1' });
        const third = version({ id: 'c', version: 3, parentId: 'v1' });

        const [root] = buildVersionTree([third, second, v1]);

        expect(root.children.map((node) => node.id)).toEqual(['b', 'c']);
    });

    it('делает корнем версию с неизвестным родителем', () => {
        const orphan = version({ id: 'orphan', version: 4, parentId: 'нет-такой' });

        const roots = buildVersionTree([orphan]);

        expect(roots).toHaveLength(1);
        expect(roots[0].id).toBe('orphan');
    });

    it('на пустой истории возвращает пустое дерево', () => {
        expect(buildVersionTree([])).toEqual([]);
    });

    it('сохраняет пометку удаления у узла', () => {
        const v1 = version({ id: 'v1', version: 1, deleted: true, latest: false });

        const [root] = buildVersionTree([v1]);

        expect(root.deleted).toBe(true);
    });
});
