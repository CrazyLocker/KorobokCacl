import type { PartInput, SheetSpec } from '../model/types';

export function P(name: string, L: number, W: number, qty: number): PartInput {
    return { id: name, name, L, W, qty, rotatable: true };
}

export const BASE_SHEET: SheetSpec = {
    sheetL: 350, sheetW: 333, margin: 8, flap: 10, gap: 15, allowRotate: true,
};

export function sheetWith(patch: Partial<SheetSpec>): SheetSpec {
    return { ...BASE_SHEET, ...patch };
}