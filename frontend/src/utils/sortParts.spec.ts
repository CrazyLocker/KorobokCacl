// frontend/src/utils/sortParts.spec.ts
import { describe, expect, it } from 'vitest';
import { compareParts, sortParts } from './sortParts';

const part = (name: string) => ({ name });

const names = (list: { name: string }[]) => list.map((item) => item.name);

describe('sortParts', () => {
    it('orders known parts: Дно → Разделитель → Крышка → Окно', () => {
        const sorted = sortParts([
            part('Окно'),
            part('Крышка'),
            part('Разделитель'),
            part('Дно'),
        ]);

        expect(names(sorted)).toEqual(['Дно', 'Разделитель', 'Крышка', 'Окно']);
    });

    it('puts Дно+Разделитель after Дно but before Крышка', () => {
        const sorted = sortParts([part('Крышка'), part('Дно+Разделитель'), part('Дно')]);

        expect(names(sorted)).toEqual(['Дно', 'Дно+Разделитель', 'Крышка']);
    });

    it('puts Шубер last among known parts', () => {
        const sorted = sortParts([
            part('Шубер'),
            part('Окно'),
            part('Крышка'),
            part('Дно+Разделитель'),
            part('Разделитель'),
        ]);

        expect(names(sorted)).toEqual([
            'Дно+Разделитель', 'Разделитель', 'Крышка', 'Окно', 'Шубер',
        ]);
    });

    it('puts unknown parts last, sorted alphabetically', () => {
        const sorted = sortParts([
            part('Деталь 2'),
            part('Крышка'),
            part('Дно'),
            part('Деталь 1'),
        ]);

        expect(names(sorted)).toEqual(['Дно', 'Крышка', 'Деталь 1', 'Деталь 2']);
    });

    it('keeps unknown parts after Шубер', () => {
        const sorted = sortParts([part('Деталь 1'), part('Шубер'), part('Деталь 2')]);

        expect(names(sorted)).toEqual(['Шубер', 'Деталь 1', 'Деталь 2']);
    });

    it('puts Крышка с окном between Крышка and Окно', () => {
        const sorted = sortParts([part('Окно'), part('Крышка с окном'), part('Крышка')]);

        expect(names(sorted)).toEqual(['Крышка', 'Крышка с окном', 'Окно']);
    });

    it('orders the laminated composition: каркас → лайнер', () => {
        const sorted = sortParts([
            part('Обложка-каркас'),
            part('Дно-лайнер'),
            part('Обложка-лайнер-внутр.'),
            part('Дно-каркас'),
            part('Обложка-лайнер-внеш.'),
        ]);

        expect(names(sorted)).toEqual([
            'Дно-каркас',
            'Дно-лайнер',
            'Обложка-каркас',
            'Обложка-лайнер-внеш.',
            'Обложка-лайнер-внутр.',
        ]);
    });

    it('matches laminated names case-insensitively, keeping the trailing dot', () => {
        const sorted = sortParts([
            part('  обложка-лайнер-внутр.'),
            part('ОБЛОЖКА-ЛАЙНЕР-ВНЕШ.'),
            part('ДНО-КАРКАС'),
        ]);

        expect(names(sorted)).toEqual([
            'ДНО-КАРКАС', 'ОБЛОЖКА-ЛАЙНЕР-ВНЕШ.', '  обложка-лайнер-внутр.',
        ]);
    });

    it('compares names case-insensitively and ignores extra spaces', () => {
        const sorted = sortParts([part('  КРЫШКА '), part('дно'), part('Окно')]);

        expect(names(sorted)).toEqual(['дно', '  КРЫШКА ', 'Окно']);
    });

    it('does not fail on an empty list or a single part', () => {
        expect(sortParts([])).toEqual([]);
        expect(names(sortParts([part('Крышка')]))).toEqual(['Крышка']);
    });

    it('does not mutate the source list', () => {
        const input = [part('Крышка'), part('Дно'), part('Окно')];
        const snapshot = [...input];

        sortParts(input);

        expect(input).toEqual(snapshot);
    });
});

describe('compareParts', () => {
    it('orders the real composition of Элара 4', () => {
        const sorted = sortParts([part('Разделитель'), part('Крышка'), part('Дно')]);

        expect(names(sorted)).toEqual(['Дно', 'Разделитель', 'Крышка']);
    });

    it('orders the real composition of Этне 2 (шубер)', () => {
        const sorted = sortParts([part('Шубер'), part('Дно+Разделитель')]);

        expect(names(sorted)).toEqual(['Дно+Разделитель', 'Шубер']);
    });

    it('orders the real composition of Гималия 4 with a window', () => {
        const sorted = sortParts([
            part('Окно'), part('Разделитель'), part('Крышка'), part('Дно'),
        ]);

        expect(names(sorted)).toEqual(['Дно', 'Разделитель', 'Крышка', 'Окно']);
    });

    it('keeps Крышка с окном before the window detail', () => {
        const sorted = sortParts([
            part('Дно'), part('Разделитель'), part('Крышка с окном'), part('Окно'),
        ]);

        expect(names(sorted)).toEqual([
            'Дно', 'Разделитель', 'Крышка с окном', 'Окно',
        ]);
    });

    it('orders the real composition of Паллена 4', () => {
        const sorted = sortParts([part('Крышка'), part('Дно+Разделитель')]);

        expect(names(sorted)).toEqual(['Дно+Разделитель', 'Крышка']);
    });

    it('returns 0 for equal names', () => {
        expect(compareParts(part('Крышка'), part('Крышка'))).toBe(0);
    });
});
