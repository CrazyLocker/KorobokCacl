// frontend/src/utils/knifeRequest.ts
import type { KnifeOptions } from '../types';

/** Режим расчёта по умолчанию — как чекбоксы прототипа: оба включены. */
export const KNIFE_DEFAULT_OPTIONS: KnifeOptions = {
    useTransform: true,
    useUnits: true,
};

/** Тело запроса POST /api/knife/calculate. */
export interface KnifeCalculateRequest {
    svgContent: string;
    useTransform: boolean;
    useUnits: boolean;
}

/**
 * Собирает тело запроса расчёта ножа.
 * Не заданные флаги берутся из {@link KNIFE_DEFAULT_OPTIONS} — старые клиенты,
 * которые флаги не передают, получают поведение прототипа.
 */
export const buildKnifeRequest = (
    svgContent: string,
    options?: Partial<KnifeOptions>,
): KnifeCalculateRequest => ({
    svgContent,
    useTransform: options?.useTransform ?? KNIFE_DEFAULT_OPTIONS.useTransform,
    useUnits: options?.useUnits ?? KNIFE_DEFAULT_OPTIONS.useUnits,
});
