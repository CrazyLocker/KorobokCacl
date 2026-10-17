/**
 * Layout engine constants.
 * Values are ported from the prototype unchanged: they affect the result.
 */
import type { Clock, Palette, PackBudgets } from './types';

/** Geometry comparison epsilon, mm. */
export const RASP_EPS = 1e-6;

/** Default search budgets. */
export const DEFAULT_BUDGETS: PackBudgets = {
  evalsPerTrial: 40_000,
  evalsTotal: 400_000,
  freeHardLimit: 300,
  freeMinArea: 150,
  maxTrials: 30,
};

/**
 * Orientation policy seed.
 * Locked: changing it changes mix-layout numbers, breaking reproducibility.
 */
export const POLICY_SEED = 20_260_219;

/** Jitter seed for the trial at the given index. Ported 1:1. */
export function jitterSeed(trialIndex: number): number {
  return 100_000 + trialIndex * 7_919;
}

/** Jitter amplitude for the trial at the given index: 0.15, 0.2333, 0.3166, 0.4, cycle. */
export function jitterAmount(trialIndex: number): number {
  return 0.15 + 0.25 * ((trialIndex % 4) / 3);
}

/**
 * Trial count limit as a function of total requested parts.
 * More parts means a more expensive trial, so fewer attempts.
 */
export function trialLimitFor(
  requestedCount: number,
  base: number = DEFAULT_BUDGETS.maxTrials,
): number {
  if (requestedCount > 1000) return 4;
  if (requestedCount > 400) return 8;
  if (requestedCount > 100) return 16;
  return base;
}

/** Part type palette (RASP_PALETTE). */
export const RASP_PALETTE: readonly Palette[] = [
  { fill: '#e3f0ff', stroke: '#1a73e8', text: '#0d47a1' },
  { fill: '#e6f4ea', stroke: '#0d7c3f', text: '#0d5c2f' },
  { fill: '#fff4e5', stroke: '#e8710a', text: '#a34a00' },
  { fill: '#f3e8fd', stroke: '#8430ce', text: '#5c1f95' },
  { fill: '#fde8e8', stroke: '#d32f2f', text: '#a01f1f' },
  { fill: '#e0f7fa', stroke: '#00838f', text: '#00606a' },
  { fill: '#fce4ec', stroke: '#c2185b', text: '#8c0f42' },
  { fill: '#f1f8e9', stroke: '#558b2f', text: '#3d6321' },
  { fill: '#ede7f6', stroke: '#4527a0', text: '#2f1b70' },
  { fill: '#fff8e1', stroke: '#f9a825', text: '#a06a00' },
];

/** Palette entry for a part type index, cycling. */
export function paletteFor(index: number): Palette {
  const n = RASP_PALETTE.length;
  const i = ((Math.trunc(index) % n) + n) % n;
  return RASP_PALETTE[i];
}

/** Round to 2 decimals: memo keys and labels only, never geometry. */
export function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Clamp a value into a range. */
export function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** Default clock. Always replaced in tests. */
export const systemClock: Clock = {
  now: (): number =>
    typeof performance !== 'undefined' && typeof performance.now === 'function'
      ? performance.now()
      : Date.now(),
};
