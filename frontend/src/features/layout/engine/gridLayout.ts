/**
 * Single-part grid layout (port of raspCalculateOptimalLayout).
 *
 * Two pure grid variants: all parts at 0 degrees and all at 90 degrees.
 * Each variant takes the maximum full rows x cols; the variant with the
 * bigger total wins. 0 degrees is pushed first, so it wins a tie.
 *
 * Argument order mirrors the prototype:
 *   sheetL, sheetW, partL, partW, margin, flap, gap, allowRotate
 */
import type { GridOk, GridResult, GridVariant } from '../model/types.ts';

export function gridLayout(
  sheetL: number,
  sheetW: number,
  partL: number,
  partW: number,
  margin: number,
  flap: number,
  gap: number,
  allowRotate: boolean,
): GridResult {
  // Axis convention: workL is X, workW is Y (see model/types.ts).
  const workL = sheetL - margin * 2;
  const workW = sheetW - margin - flap - margin;

  if (workL <= 0 || workW <= 0) {
    return { ok: false, error: 'work area is not positive: reduce margin or flap' };
  }

  const countInRow = (size: number, available: number): number => {
    if (size > available) return 0;
    return Math.floor((available + gap) / (size + gap));
  };

  const cols0 = countInRow(partL, workL);
  const rows0 = countInRow(partW, workW);
  const total0 = cols0 * rows0;

  let cols90 = 0;
  let rows90 = 0;
  let total90 = 0;

  if (allowRotate) {
    cols90 = countInRow(partW, workL);
    rows90 = countInRow(partL, workW);
    total90 = cols90 * rows90;
  }

  const variants: GridVariant[] = [];

  if (total0 > 0) {
    const groupWidth = cols0 * partL + (cols0 - 1) * gap;
    const groupHeight = rows0 * partW + (rows0 - 1) * gap;
    variants.push({
      id: 'variant_0',
      type: 'All 0 deg',
      total: total0,
      rows: rows0,
      cols: cols0,
      isRotated: false,
      detailW: partL,
      detailH: partW,
      groupWidth,
      groupHeight,
    });
  }

  if (allowRotate && total90 > 0) {
    const groupWidth = cols90 * partW + (cols90 - 1) * gap;
    const groupHeight = rows90 * partL + (rows90 - 1) * gap;
    variants.push({
      id: 'variant_90',
      type: 'All 90 deg',
      total: total90,
      rows: rows90,
      cols: cols90,
      isRotated: true,
      detailW: partW,
      detailH: partL,
      groupWidth,
      groupHeight,
    });
  }

  if (variants.length === 0) {
    return { ok: false, error: 'no part fits the sheet with the given parameters' };
  }

  variants.sort((a, b) => b.total - a.total);

  const result: GridOk = {
    ok: true,
    variants,
    best: variants[0],
    workL,
    workW,
    partL,
    partW,
    sheetL,
    sheetW,
    margin,
    flap,
    gap,
    allowRotate,
  };

  return result;
}
