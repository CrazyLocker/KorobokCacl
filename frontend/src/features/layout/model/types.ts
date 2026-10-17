/**
 * Layout engine contracts.
 *
 * Source: prototype, section 5.3 (multi-part layout).
 * Field names intentionally mirror the prototype (L, W, sheetL, sheetW)
 * so that line-by-line porting stays verifiable.
 *
 * Axis convention (locked, prevents sheet transposition):
 *   sheetL -> X, sheetW -> Y
 *   workW  -> usable width along X, workH -> usable height along Y
 * Note: prototype raspCalculateOptimalLayout uses workL/workW for (X, Y).
 * That is a different convention and is renamed during porting.
 */

/** Colour scheme of one part type (element of RASP_PALETTE). */
export interface Palette {
  fill: string;
  stroke: string;
  text: string;
}

/** Sheet geometry and technology parameters. */
export interface SheetSpec {
  /** Long side of the sheet, mm. Axis X. */
  sheetL: number;
  /** Short side of the sheet, mm. Axis Y. */
  sheetW: number;
  /** Margin on each side, mm. Subtracted twice on both axes. */
  margin: number;
  /** Flap, mm. Subtracted on axis Y only. Always 0 for printing. */
  flap: number;
  /** Technology gap between parts, mm. */
  gap: number;
  /** Whether a part may be rotated by 90 degrees. */
  allowRotate: boolean;
}

/** One part on input. */
export interface PartInput {
  id?: string;
  name: string;
  /** Size along X, mm. */
  L: number;
  /** Size along Y, mm. */
  W: number;
  /** How many to place. Per-part and print modes pass 999. */
  qty: number;
  /**
   * false means the part cannot be rotated (rigid orientation).
   * Defaults to true, but only when sheet.allowRotate is also true.
   */
  rotatable?: boolean;
  /** When omitted, RASP_PALETTE[i % length] is used. */
  color?: Palette;
}

/**
 * Search budgets. This is part of the contract, not an optimisation:
 * different values produce different numbers and different timing.
 */
export interface PackBudgets {
  /** Candidate checks per single trial. */
  evalsPerTrial: number;
  /** Candidate checks for the whole packParts call. */
  evalsTotal: number;
  /** Hard cap on the free rectangle list. */
  freeHardLimit: number;
  /** Minimum area of a useful free rectangle. */
  freeMinArea: number;
  /** Base trial limit (reduced by requestedCount). */
  maxTrials: number;
}

/** A placed part in sheet working coordinates (no margin/flap). */
export interface PlacedItem {
  /** Type index equals index in the source parts array. */
  typeIndex: number;
  x: number;
  y: number;
  w: number;
  h: number;
  /** true when the part is rotated by 90 degrees. */
  rotated: boolean;
}

/** Summary for one part type. */
export interface ByTypeItem {
  partId?: string;
  name: string;
  typeIndex: number;
  color: Palette;
  /** Requested quantity. */
  requested: number;
  /** How many fit on one sheet. */
  placed: number;
  /** How many did not fit. */
  missing: number;
  /** ceil(requested / placed), or null when placed is 0. */
  sheets: number | null;
  L: number;
  W: number;
}

/** Reason a part was not placed. */
export type NotPlacedReason = 'oversized' | 'badInput' | 'noSpace';

/** A part that did not make it onto the sheet. */
export interface NotPlacedItem {
  partId?: string;
  name: string;
  reason: NotPlacedReason;
}

/** Which algorithm produced the final packing. */
export type PackEngine = 'guillotine' | 'maxrects';

/** Successful packing result. */
export interface PackOk {
  ok: true;

  placed: PlacedItem[];
  byType: ByTypeItem[];
  notPlaced: NotPlacedItem[];
  /** Parts that physically do not fit the working area. */
  oversized: NotPlacedItem[];
  /** Invariant violations. Empty in a healthy run. */
  warnings: string[];

  workW: number;
  workH: number;
  workArea: number;
  sheetArea: number;
  usedArea: number;
  wasteArea: number;
  /** Percent 0..100, not a fraction. */
  utilizationWork: number;
  utilizationSheet: number;
  bounds: { w: number; h: number };

  placedCount: number;
  requestedCount: number;
  /** Max over types of ceil(requested / placed); at least 1. */
  sheetsForOrder: number;
  trials: number;
  engine: PackEngine;

  /** Run time. UI debug only, never used in calculations. */
  ms?: number;
}

/**
 * Error instead of an exception, same shape as the prototype return { error }.
 * ok: false allows narrowing without try/catch.
 */
export interface PackError {
  ok: false;
  error: string;
  warnings?: string[];
  notPlaced?: NotPlacedItem[];
  oversized?: NotPlacedItem[];
}

export type PackResult = PackOk | PackError;

/** Request for packParts. */
export interface PackRequest {
  sheet: SheetSpec;
  parts: PartInput[];
  /** Partial budget override, for tests and debugging. */
  budgets?: Partial<PackBudgets>;
}

// ---------------------------------------------------------------
// Internal engine types
// ---------------------------------------------------------------

/** Deterministic generator returning [0, 1). */
export type Rng = () => number;

/** Free rectangle inside the working area. */
export interface FreeRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Orientation policy per type: 0 as given, 1 flipped. */
export type OrientPolicy = Record<number, 0 | 1>;

/** Random score scatter parameters. */
export interface JitterSpec {
  seed: number;
  /** Amplitude: score is multiplied by (1 +- amount/2). */
  amount: number;
}

/** One trial: orientation policy plus optional jitter. */
export interface Trial {
  policy: OrientPolicy;
  jitter: JitterSpec | null;
}

/** Part after the orientation policy has been applied. */
export interface ExpandedPart {
  partId?: string;
  name: string;
  typeIndex: number;
  /** Size along X after the policy. */
  L: number;
  /** Size along Y after the policy. */
  W: number;
  qty: number;
  area: number;
  rotatable: boolean;
  color: Palette;
}

/** Result of one greedy trial. */
export interface TrialRun {
  placed: PlacedItem[];
  /** Leftover counts per type. */
  counts: Record<number, number>;
  maxX: number;
  maxY: number;
  placedCount: number;
  usedArea: number;
  /** Candidate checks actually spent. */
  evals: number;
}

/** Orientation of a part inside a specific rectangle. */
export interface Orientation {
  w: number;
  h: number;
  rotated: boolean;
}

/** Candidate chosen by the greedy pass. */
export interface Candidate {
  part: ExpandedPart;
  rect: FreeRect;
  item: Orientation & { x: number; y: number; gap: number };
  itemArea: number;
  freeArea: number;
  score: number;
}

/** Result of the guillotine algorithm. */
export interface GuillotineResult {
  placed: PlacedItem[];
  count: number;
  usedArea: number;
}

/** Variant of single-part grid layout. */
export interface GridVariant {
  id: 'variant_0' | 'variant_90';
  type: 'All 0 deg' | 'All 90 deg';
  total: number;
  rows: number;
  cols: number;
  isRotated: boolean;
  detailW: number;
  detailH: number;
  groupWidth: number;
  groupHeight: number;
}

/** Successful single-part layout. */
export interface GridOk {
  ok: true;
  /** Sorted by total descending. */
  variants: GridVariant[];
  best: GridVariant;
  /** Working area along X. */
  workL: number;
  /** Working area along Y. */
  workW: number;
  partL: number;
  partW: number;
  sheetL: number;
  sheetW: number;
  margin: number;
  flap: number;
  gap: number;
  allowRotate: boolean;
}

export interface GridError {
  ok: false;
  error: string;
}

export type GridResult = GridOk | GridError;

/** Time injection so tests do not depend on performance.now(). */
export interface Clock {
  now(): number;
}

/** Engine options unrelated to geometry. */
export interface EngineOptions {
  clock?: Clock;
  budgets?: Partial<PackBudgets>;
}
