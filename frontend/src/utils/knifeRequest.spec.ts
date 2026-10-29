// frontend/src/utils/knifeRequest.spec.ts
import { describe, expect, it } from 'vitest';
import { KNIFE_DEFAULT_OPTIONS, buildKnifeRequest } from './knifeRequest';

describe('KNIFE_DEFAULT_OPTIONS', () => {
    it('оба режима включены по умолчанию, как в прототипе', () => {
        expect(KNIFE_DEFAULT_OPTIONS).toEqual({ useTransform: true, useUnits: true });
    });
});

describe('buildKnifeRequest', () => {
    it('без опций отправляет флаги по умолчанию', () => {
        expect(buildKnifeRequest('<svg/>')).toEqual({
            svgContent: '<svg/>',
            useTransform: true,
            useUnits: true,
        });
    });

    it('прокидывает выключенные флаги в тело запроса', () => {
        expect(buildKnifeRequest('<svg/>', { useTransform: false, useUnits: false })).toEqual({
            svgContent: '<svg/>',
            useTransform: false,
            useUnits: false,
        });
    });

    it('частичные опции дополняются значениями по умолчанию', () => {
        expect(buildKnifeRequest('<svg/>', { useTransform: false })).toEqual({
            svgContent: '<svg/>',
            useTransform: false,
            useUnits: true,
        });
        expect(buildKnifeRequest('<svg/>', { useUnits: false })).toEqual({
            svgContent: '<svg/>',
            useTransform: true,
            useUnits: false,
        });
    });
});
