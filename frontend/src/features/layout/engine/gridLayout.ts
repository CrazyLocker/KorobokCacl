/**
 * Single-part grid layout (port of raspCalculateOptimalLayout).
 *
 * NOT IMPLEMENTED YET. The body throws on purpose, same rationale as
 * packParts: a red test is the intended state until the port lands.
 *
 * Argument order mirrors the prototype:
 *   sheetL, sheetW, partL, partW, margin, flap, gap, allowRotate
 */
import type { GridResult } from '../model/types.ts';

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
  void sheetL;
  void sheetW;
  void partL;
  void partW;
  void margin;
  void flap;
  void gap;
  void allowRotate;
  throw new Error('gridLayout is not implemented yet');
}
