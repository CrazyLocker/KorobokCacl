// frontend/src/utils/latestRequest.spec.ts
import { describe, expect, it } from 'vitest';
import { createLatestRequestTracker } from './latestRequest';

describe('createLatestRequestTracker', () => {
    it('считает актуальным только последний запрос', () => {
        const tracker = createLatestRequestTracker();

        const first = tracker.next();
        const second = tracker.next();

        expect(tracker.isCurrent(first.id)).toBe(false);
        expect(tracker.isCurrent(second.id)).toBe(true);
        expect(second.id).toBeGreaterThan(first.id);
    });

    it('отменяет предыдущий запрос при старте следующего', () => {
        const tracker = createLatestRequestTracker();

        const first = tracker.next();
        const second = tracker.next();

        expect(first.signal.aborted).toBe(true);
        expect(second.signal.aborted).toBe(false);
    });

    it('распознаёт ошибку отмены и не считает её отказом сервера', () => {
        const tracker = createLatestRequestTracker();

        expect(tracker.isCancelled({ name: 'CanceledError' })).toBe(true);
        expect(tracker.isCancelled({ code: 'ERR_CANCELED' })).toBe(true);
        expect(tracker.isCancelled({ name: 'AbortError' })).toBe(true);
        expect(tracker.isCancelled(new Error('Ошибка расчёта'))).toBe(false);
        expect(tracker.isCancelled(null)).toBe(false);
    });

    it('abort отменяет текущий запрос и снимает актуальность', () => {
        const tracker = createLatestRequestTracker();
        const request = tracker.next();

        tracker.abort();

        expect(request.signal.aborted).toBe(true);
        expect(tracker.isCurrent(request.id)).toBe(false);
    });
});
