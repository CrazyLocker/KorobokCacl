// frontend/src/utils/calculationRequest.ts
import type { ApiDetail } from '../types';

let detailSequence = 0;

/**
 * Stable client-side row id. It lives only in React state and must never be
 * sent to the backend; use toApiDetails() right before an API request.
 */
export const createDetailUiKey = (): string =>
    `detail-${Date.now().toString(36)}-${++detailSequence}`;

/**
 * Removes the client-only `uiKey` from details without mutating the input.
 * The calculator and the save dialog both use this before calling the API.
 */
export const toApiDetails = (
    details: ReadonlyArray<{ uiKey?: string } & Omit<ApiDetail, 'uiKey'>>,
): ApiDetail[] =>
    details.map((detail) => {
        const copy: { uiKey?: string } & ApiDetail = { ...detail };
        delete copy.uiKey;
        return copy;
    });
