import { describe, it, expect } from 'vitest';
import { packParts } from '../engine/packParts';
import { gridLayout } from '../engine/gridLayout';
import type { PackOk, PackResult, PartInput } from '../model/types';
import { P, sheetWith } from './fixtures';

function expectOk(result: PackResult): PackOk {
    expect(result.ok).toBe(true);
    return result as PackOk;
}

function pack(parts: PartInput[], patch = {}): PackResult {
    return packParts({ sheet: sheetWith(patch), parts });
}

describe('Layout Engine', () => {
    it('T-1 single part 100x180 on 350x333 gives 3 per sheet', () => {
        const r = gridLayout(350, 333, 100, 180, 8, 10, 15, true);
        if ('error' in r) throw new Error(r.error);
        expect(r.best.total).toBe(3);
    });

    it('T-2 six parts 100x180 fit four per sheet', () => {
        const r = expectOk(pack([P('Bottom', 100, 180, 6)]));
        expect(r.placedCount).toBe(4);
    });

    it('T-3 mixed twelve parts 100x180 fit four per sheet', () => {
        const r = expectOk(pack([P('Bottom', 100, 180, 6), P('Lid', 100, 180, 4), P('Insert', 100, 180, 2)]));
        expect(r.placedCount).toBe(4);
    });
});