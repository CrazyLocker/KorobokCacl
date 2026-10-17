/**
 * Layout invariant checks (port of raspValidateLayout).
 * Returns human readable violations; an empty array means a healthy layout.
 * Messages are ASCII on purpose: source encoding must stay transport-safe.
 */
import { RASP_EPS } from '../model/constants.ts';
import type { FreeRect, PlacedItem } from '../model/types.ts';

/** True when inner lies fully inside outer, with epsilon tolerance. */
export function rectContains(outer: FreeRect, inner: FreeRect): boolean {
  return (
    inner.x >= outer.x - RASP_EPS &&
    inner.y >= outer.y - RASP_EPS &&
    inner.x + inner.w <= outer.x + outer.w + RASP_EPS &&
    inner.y + inner.h <= outer.y + outer.h + RASP_EPS
  );
}

/** Two parts violate the gap rule when their inflated boxes intersect. */
function violatesGap(a: PlacedItem, b: PlacedItem, gap: number): boolean {
  const overlapX = a.x < b.x + b.w + gap - RASP_EPS && b.x < a.x + a.w + gap - RASP_EPS;
  const overlapY = a.y < b.y + b.h + gap - RASP_EPS && b.y < a.y + a.h + gap - RASP_EPS;
  return overlapX && overlapY;
}

/**
 * Full validation of a pack result.
 *
 * Checks, in order: finite numbers, positive sizes, non-negative origin,
 * containment in the working area, pairwise gap compliance.
 */
export function validateLayout(
  placed: PlacedItem[],
  workW: number,
  workH: number,
  gap: number,
): string[] {
  const errors: string[] = [];

  if (!Number.isFinite(workW) || !Number.isFinite(workH)) {
    errors.push('work area is not finite');
    return errors;
  }

  const g = Number.isFinite(gap) && gap > 0 ? gap : 0;

  for (let i = 0; i < placed.length; i += 1) {
    const it = placed[i];
    const tag = 'item ' + i + ' (type ' + it.typeIndex + ')';

    if (
      !Number.isFinite(it.x) ||
      !Number.isFinite(it.y) ||
      !Number.isFinite(it.w) ||
      !Number.isFinite(it.h)
    ) {
      errors.push(tag + ': non-finite geometry');
      continue;
    }

    if (it.w <= RASP_EPS || it.h <= RASP_EPS) {
      errors.push(tag + ': non-positive size');
      continue;
    }

    if (it.x < -RASP_EPS || it.y < -RASP_EPS) {
      errors.push(tag + ': negative origin');
    }

    if (it.x + it.w > workW + RASP_EPS) {
      errors.push(tag + ': exceeds work width');
    }

    if (it.y + it.h > workH + RASP_EPS) {
      errors.push(tag + ': exceeds work height');
    }

    for (let j = i + 1; j < placed.length; j += 1) {
      if (violatesGap(it, placed[j], g)) {
        errors.push(tag + ' overlaps item ' + j);
      }
    }
  }

  return errors;
}
