// frontend/src/utils/sortConstructs.spec.ts
import { describe, expect, it } from 'vitest';
import type { Construct } from '../types';
import { compareConstructs, parseConstructName, sortConstructs } from './sortConstructs';

const construct = (name: string, type?: string): Construct => ({
    id: name,
    name,
    type,
    parts: [],
    isActive: true,
});

describe('parseConstructName', () => {
    it('splits class and size', () => {
        expect(parseConstructName('Элара 4')).toEqual({ className: 'Элара', size: 4 });
    });

    it('reads the number before the (шубер) suffix', () => {
        expect(parseConstructName('Этне 10 (шубер)')).toEqual({ className: 'Этне', size: 10 });
    });

    it('returns null size when the name has no number', () => {
        expect(parseConstructName('Тестовая')).toEqual({ className: 'Тестовая', size: null });
    });
});

describe('sortConstructs', () => {
    // Имена в произвольном порядке, как их отдаёт API.
    const apiOrder = [
        'Паллена 4', 'Элара 25', 'Элара 16', 'Элара 9', 'Элара 42', 'Паллена 42',
        'Этне 3 (шубер)', 'Этне 16 (шубер)', 'Этне 15 (шубер)', 'Гималия 16',
        'Гималия 9', 'Гималия 4', 'Этне 2 (шубер)', 'Тестовая', 'Гималия 42',
        'Гималия 25', 'Эгеон 9', 'Эгеон 42', 'Эгеон 4', 'Эгеон 25', 'Эгеон 16',
        'Нереида 42', 'Нереида 9', 'Нереида 25', 'Нереида 4', 'Нереида 16',
        'Элара 4', 'Этне 5 (шубер)', 'Паллена 9', 'Этне 6 (шубер)', 'Этне 12 (шубер)',
        'Паллена 16', 'Паллена 25', 'Атлас', 'Этне 4 (шубер)', 'Этне 10 (шубер)',
    ];

    const expected = [
        'Элара 4', 'Элара 9', 'Элара 16', 'Элара 25', 'Элара 42',
        'Паллена 4', 'Паллена 9', 'Паллена 16', 'Паллена 25', 'Паллена 42',
        'Этне 2 (шубер)', 'Этне 3 (шубер)', 'Этне 4 (шубер)', 'Этне 5 (шубер)',
        'Этне 6 (шубер)', 'Этне 10 (шубер)', 'Этне 12 (шубер)', 'Этне 15 (шубер)',
        'Этне 16 (шубер)',
        'Гималия 4', 'Гималия 9', 'Гималия 16', 'Гималия 25', 'Гималия 42',
        'Эгеон 4', 'Эгеон 9', 'Эгеон 16', 'Эгеон 25', 'Эгеон 42',
        'Нереида 4', 'Нереида 9', 'Нереида 16', 'Нереида 25', 'Нереида 42',
        'Атлас',
        'Тестовая',
    ];

    it('orders by class, then numerically by size', () => {
        const sorted = sortConstructs(apiOrder.map((name) => construct(name)));
        expect(sorted.map((item) => item.name)).toEqual(expected);
    });

    it('does not mutate the source list', () => {
        const input = apiOrder.map((name) => construct(name));
        const snapshot = [...input];

        sortConstructs(input);

        expect(input).toEqual(snapshot);
    });

    it('puts unknown classes last, sorted alphabetically', () => {
        const sorted = sortConstructs([
            construct('Якорь 5'),
            construct('Элара 9'),
            construct('Бутылка 2'),
        ]);

        expect(sorted.map((item) => item.name)).toEqual(['Элара 9', 'Бутылка 2', 'Якорь 5']);
    });

    it('falls back to the name when type is missing and prefers type when it is set', () => {
        const byType = sortConstructs([construct('Старое имя 3', 'ELARA'), construct('Атлас')]);
        expect(byType.map((item) => item.name)).toEqual(['Старое имя 3', 'Атлас']);
    });

    it('keeps a sizeless construction after the sized ones of its class', () => {
        const sorted = sortConstructs([construct('Гималия'), construct('Гималия 4')]);
        expect(sorted.map((item) => item.name)).toEqual(['Гималия 4', 'Гималия']);
    });

    it('maps type INDIVIDUAL to the «Индивидуальная» class (first, ahead of «Элара»)', () => {
        // Класс берётся из type, а не из имени: «На заказ 1» встаёт перед «Эларой».
        const sorted = sortConstructs([construct('Элара 4'), construct('На заказ 1', 'INDIVIDUAL')]);
        expect(sorted.map((item) => item.name)).toEqual(['На заказ 1', 'Элара 4']);
    });

    it('maps type LAMINATED to the «Кашированная» class (after «Индивидуальная», before «Элара»)', () => {
        const sorted = sortConstructs([
            construct('Элара 4'),
            construct('Плёнка 9', 'LAMINATED'),
            construct('На заказ 1', 'INDIVIDUAL'),
        ]);
        expect(sorted.map((item) => item.name)).toEqual(['На заказ 1', 'Плёнка 9', 'Элара 4']);
    });

    it('puts «Индивидуальная» and «Кашированная» before «Элара 4», so the default is «Индивидуальная»', () => {
        const sorted = sortConstructs([
            construct('Элара 4'),
            construct('Кашированная'),
            construct('Индивидуальная'),
        ]);
        expect(sorted.map((item) => item.name)).toEqual(['Индивидуальная', 'Кашированная', 'Элара 4']);
    });
});

describe('compareConstructs', () => {
    it('sorts numbers numerically, not lexicographically', () => {
        expect(compareConstructs(construct('Этне 10 (шубер)'), construct('Этне 2 (шубер)'))).toBeGreaterThan(0);
        expect(compareConstructs(construct('Этне 2 (шубер)'), construct('Этне 10 (шубер)'))).toBeLessThan(0);
    });
});
