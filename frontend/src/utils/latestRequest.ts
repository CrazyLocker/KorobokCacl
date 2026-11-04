// frontend/src/utils/latestRequest.ts

/** Запрос, который считается актуальным, пока не начат следующий. */
export interface LatestRequest {
    /** Номер запроса: ответ применяется, только если номер всё ещё текущий. */
    id: number;
    /** Отменяет запрос при появлении более свежего. */
    signal: AbortSignal;
}

export interface LatestRequestTracker {
    /** Начинает новый запрос и отменяет предыдущий. */
    next: () => LatestRequest;
    /** true, если ответ с этим номером ещё актуален. */
    isCurrent: (id: number) => boolean;
    /** Отменяет текущий запрос (например, при размонтировании). */
    abort: () => void;
    /** true, если ошибка — это отмена запроса, а не отказ сервера. */
    isCancelled: (error: unknown) => boolean;
}

/**
 * Держит только последний запрос.
 *
 * <p>Пока пользователь меняет параметры, предыдущий расчёт устаревает: его
 * ответ не должен перебивать свежий, а ошибка отмены не должна попадать в
 * интерфейс как отказ сервера.
 */
export function createLatestRequestTracker(): LatestRequestTracker {
    let seq = 0;
    let current: { id: number; controller: AbortController } | null = null;

    return {
        next(): LatestRequest {
            current?.controller.abort();
            const controller = new AbortController();
            const id = ++seq;
            current = { id, controller };
            return { id, signal: controller.signal };
        },
        isCurrent: (id: number) => current?.id === id,
        abort: () => {
            current?.controller.abort();
            current = null;
        },
        isCancelled: (error: unknown) => {
            if (typeof error !== 'object' || error === null) return false;
            const candidate = error as { name?: unknown; code?: unknown };
            return candidate.name === 'CanceledError'
                || candidate.name === 'AbortError'
                || candidate.code === 'ERR_CANCELED';
        },
    };
}
