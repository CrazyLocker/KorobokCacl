// frontend/src/utils/sortParts.spec.ts
import { describe, expect, it } from 'vitest';
import { compareParts, sortParts } from './sortParts';

const part = (name: string) => ({ name });

const names = (list: { name: string }[]) => list.map((item) => item.name);

describe('sortParts', () => {
    it('orders known parts: Дно → Крышка → Разделитель → Окно', () => {
        const sorted = sortParts([
            part('Окно'),
            part('Разделитель'),
            part('Крышка'),
            part('Дно'),
        ]);

        expect(names(sorted)).toEqual(['Дно', 'Крышка', 'Разделитель', 'Окно']);
    });

    it('puts Дно+Разделитель after Дно but before Крышка', () => {
        const sorted = sortParts([part('Крышка'), part('Дно+Разделитель'), part('Дно')]);

        expect(names(sorted)).toEqual(['Дно', 'Дно+Разделитель', 'Крышка']);
    });

    it('puts Шубер last among known parts', () => {
        const sorted = sortParts([
            part('Шубер'),
            part('Окно'),
            part('Дно+Разделитель'),
            part('Разделитель'),
        ]);

        expect(names(sorted)).toEqual(['Дно+Разделитель', 'Разделитель', 'Окно', 'Шубер']);
    });

    it('puts unknown parts last, sorted alphabetically', () => {
        const sorted = sortParts([
            part('Крышка-лайнер'),
            part('Крышка'),
            part('Дно'),
            part('Дно-лайнер'),
        ]);

        expect(names(sorted)).toEqual(['Дно', 'Крышка', 'Дно-лайнер', 'Крышка-лайнер']);
    });

    it('keeps unknown parts after Шубер', () => {
        const sorted = sortParts([part('Деталь 1'), part('Шубер'), part('Крышка с окном')]);

        expect(names(sorted)).toEqual(['Шубер', 'Деталь 1', 'Крышка с окном']);
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

        expect(names(sorted)).toEqual(['Дно', 'Крышка', 'Разделитель']);
    });

    it('orders the real composition of Этне 2 (шубер)', () => {
        const sorted = sortParts([part('Шубер'), part('Дно+Разделитель')]);

        expect(names(sorted)).toEqual(['Дно+Разделитель', 'Шубер']);
    });

    it('orders the real composition of Гималия 4 with a window', () => {
        const sorted = sortParts([
            part('Окно'), part('Разделитель'), part('Крышка'), part('Дно'),
        ]);

        expect(names(sorted)).toEqual(['Дно', 'Крышка', 'Разделитель', 'Окно']);
    });

    it('orders the real composition of Паллена 4', () => {
        const sorted = sortParts([part('Крышка'), part('Дно+Разделитель')]);

        expect(names(sorted)).toEqual(['Дно+Разделитель', 'Крышка']);
    });

    it('returns 0 for equal names', () => {
        expect(compareParts(part('Крышка'), part('Крышка'))).toBe(0);
    });
});
