/**
 * React binding for the layout engine.
 *
 * Keeps the sheet, the part list, the single part and the layout mode in state
 * and recomputes the layout whenever any of them changes:
 *   multi  -> packParts (mix of parts)
 *   single -> gridLayout (the single part, edited on its own fields)
 *
 * packParts is synchronous and can spend tens of milliseconds in one tick,
 * so the calculation is deferred to the next macrotask. That lets the UI
 * paint `isCalculating` before the engine blocks the thread, and it makes an
 * in-flight calculation cancellable when the inputs change again.
 */
import { useEffect, useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { gridLayout, packParts } from '../engine/index.ts';
import type { GridResult, PackResult, PartInput, SheetSpec } from '../model/types.ts';

/** One part type on a grid, or a mix of parts packed together. */
export type LayoutMode = 'single' | 'multi';

/**
 * Part of the single mode: a name and one size, no quantity.
 * Quantity is meaningless for the grid layout - it fills the sheet.
 */
export type SinglePart = Pick<PartInput, 'name' | 'L' | 'W'>;

/** Engine output: GridResult for single mode, PackResult for multi mode. */
export type LayoutResult = PackResult | GridResult;

export interface UseLayoutReturn {
  sheet: SheetSpec;
  setSheet: Dispatch<SetStateAction<SheetSpec>>;
  parts: PartInput[];
  setParts: Dispatch<SetStateAction<PartInput[]>>;
  /** The part edited in single mode; ignored in multi mode. */
  singlePart: SinglePart;
  setSinglePart: Dispatch<SetStateAction<SinglePart>>;
  mode: LayoutMode;
  setMode: Dispatch<SetStateAction<LayoutMode>>;
  /**
   * Latest engine output for the current mode, or null when nothing can be
   * laid out yet. While recalculating the same mode the previous result is
   * kept, so the canvas does not flicker; a result of a different mode is
   * never exposed.
   */
  result: LayoutResult | null;
  /** true while a calculation for the current inputs is pending. */
  isCalculating: boolean;
}

/** Sheet defaults of the prototype: the 1000×700 quick format. */
const DEFAULT_SHEET: SheetSpec = {
  sheetL: 1000,
  sheetW: 700,
  margin: 8,
  flap: 10,
  gap: 15,
  allowRotate: true,
};

/**
 * The page opens in single mode, matching the prototype: LayoutSvgSingle renders
 * the grid layout of the single part, so the canvas is never empty.
 */
const DEFAULT_MODE: LayoutMode = 'single';

/** Single-part defaults from the prototype single-mode fields. */
const DEFAULT_SINGLE_PART: SinglePart = { name: 'Дно', L: 100, W: 180 };

/**
 * Result together with the mode it was produced for.
 * Switching mode must not expose a GridOk to code that expects PackOk (or the
 * other way round), so a result of a different mode is reported as null until
 * the new calculation finishes.
 */
interface ComputedLayout {
  mode: LayoutMode;
  value: LayoutResult | null;
}

/**
 * Multi mode packs the part list as a mix; single mode lays out one part on a
 * regular grid from its own state, ignoring the list.
 *
 * gridLayout divides by the part size, so a zero or negative size would produce
 * a meaningless grid. Until the size is valid single mode reports "nothing to
 * lay out" (null) instead of an error, so the canvas stays calm while typing.
 */
function calculateLayout(
  sheet: SheetSpec,
  parts: PartInput[],
  mode: LayoutMode,
  singlePart: SinglePart,
): LayoutResult | null {
  if (mode === 'multi') {
    return packParts({ sheet, parts });
  }

  if (!(singlePart.L > 0) || !(singlePart.W > 0)) return null;

  return gridLayout(
    sheet.sheetL,
    sheet.sheetW,
    singlePart.L,
    singlePart.W,
    sheet.margin,
    sheet.flap,
    sheet.gap,
    sheet.allowRotate,
  );
}

export function useLayout(): UseLayoutReturn {
  const [sheet, setSheet] = useState<SheetSpec>(() => ({ ...DEFAULT_SHEET }));
  const [parts, setParts] = useState<PartInput[]>([]);
  const [singlePart, setSinglePart] = useState<SinglePart>(() => ({ ...DEFAULT_SINGLE_PART }));
  const [mode, setMode] = useState<LayoutMode>(DEFAULT_MODE);

  const [computed, setComputed] = useState<ComputedLayout | null>(null);
  const [isCalculating, setIsCalculating] = useState<boolean>(true);

  useEffect(() => {
    let cancelled = false;

    setIsCalculating(true);

    const handle = setTimeout(() => {
      if (cancelled) return;
      setComputed({ mode, value: calculateLayout(sheet, parts, mode, singlePart) });
      setIsCalculating(false);
    }, 0);

    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [sheet, parts, singlePart, mode]);

  const result = computed && computed.mode === mode ? computed.value : null;

  return {
    sheet,
    setSheet,
    parts,
    setParts,
    singlePart,
    setSinglePart,
    mode,
    setMode,
    result,
    isCalculating,
  };
}
