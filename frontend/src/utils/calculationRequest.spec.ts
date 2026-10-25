// frontend/src/utils/calculationRequest.spec.ts
import { describe, expect, it } from 'vitest';
import type { Detail } from '../types';
import { createDetailUiKey, toApiDetails } from './calculationRequest';

const detail = (name: string): Detail => ({
    uiKey: createDetailUiKey(),
    name,
    countOnSheet: 2,
    sheetPrice: 42,
    isPrinted: false,
    partsPerSheetOnPrint: 1,
    isCustom: false,
    enabled: true,
    operations: {},
});

describe('toApiDetails', () => {
    it('removes client-only uiKey from every detail', () => {
        const input = [detail('Дно'), detail('Крышка')];

        const payload = toApiDetails(input);

        expect(payload).toHaveLength(2);
        payload.forEach((row) => expect(row).not.toHaveProperty('uiKey'));
        expect(payload.map((row) => row.name)).toEqual(['Дно', 'Крышка']);
    });

    it('does not mutate the details held in React state', () => {
        const input = [detail('Дно')];

        toApiDetails(input);

        expect(input[0].uiKey).toMatch(/^detail-/);
    });
});

describe('createDetailUiKey', () => {
    it('returns unique keys for consecutive details', () => {
        const keys = new Set(Array.from({ length: 50 }, createDetailUiKey));

        expect(keys.size).toBe(50);
    });
});
