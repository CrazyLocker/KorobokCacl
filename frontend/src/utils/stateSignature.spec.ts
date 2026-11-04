// frontend/src/utils/stateSignature.spec.ts
import { describe, expect, it } from 'vitest';
import { hasUnsavedChanges, stateSignature } from './stateSignature';

describe('stateSignature', () => {
    it('совпадает у одинаковых состояний', () => {
        const state = { construction: 'Элара 9', workPrice: 5, details: [{ name: 'Дно' }] };

        expect(stateSignature(state)).toBe(stateSignature({ ...state }));
    });

    it('меняется при правке любого поля', () => {
        const state = { construction: 'Элара 9', workPrice: 5 };

        expect(stateSignature(state)).not.toBe(stateSignature({ ...state, workPrice: 6 }));
    });
});

describe('hasUnsavedChanges', () => {
    it('без зафиксированного состояния правок нет', () => {
        expect(hasUnsavedChanges(null, { workPrice: 5 })).toBe(false);
        expect(hasUnsavedChanges('', { workPrice: 5 })).toBe(false);
    });

    it('видит расхождение с сохранённым состоянием', () => {
        const saved = stateSignature({ workPrice: 5 });

        expect(hasUnsavedChanges(saved, { workPrice: 5 })).toBe(false);
        expect(hasUnsavedChanges(saved, { workPrice: 7 })).toBe(true);
    });
});
