// frontend/src/utils/margin.spec.ts
import { describe, expect, it } from 'vitest';
import { COMPLEX_MARGIN, DEFAULT_MARGIN, defaultMarginForConstruction } from './margin';

describe('defaultMarginForConstruction', () => {
    it('для «Кашированной» берёт 200 ₽', () => {
        expect(defaultMarginForConstruction('Кашированная')).toBe(COMPLEX_MARGIN);
        expect(COMPLEX_MARGIN).toBe(200);
    });

    it('не зависит от регистра, ё и лишних пробелов', () => {
        expect(defaultMarginForConstruction('  кашированная  ')).toBe(200);
        expect(defaultMarginForConstruction('КАШИРОВАННАЯ')).toBe(200);
    });

    it('для остальных конструкций оставляет 30 ₽', () => {
        expect(defaultMarginForConstruction('Элара 9')).toBe(DEFAULT_MARGIN);
        expect(defaultMarginForConstruction('Нереида 9 красная')).toBe(30);
        expect(defaultMarginForConstruction('')).toBe(30);
        expect(defaultMarginForConstruction(null)).toBe(30);
    });
});
