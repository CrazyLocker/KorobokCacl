/**
 * Multi-part layout orchestrator (port of raspPackParts).
 *
 * Picks the best of several deterministic greedy trials and keeps the
 * guillotine fallback for same-size sets. A final validateLayout pass guards
 * the geometry before the result is returned: a wrong sheet count is worse
 * than a loud failure, because it goes straight into pricing.
 */
import {
  DEFAULT_BUDGETS,
  POLICY_SEED,
  RASP_EPS,
  jitterAmount,
  jitterSeed,
  paletteFor,
  round2,
  systemClock,
  trialLimitFor,
} from '../model/constants.ts';
import { makeRng } from '../model/rng.ts';
import { validateLayout } from './validate.ts';
import type {
  ByTypeItem,
  Candidate,
  ExpandedPart,
  FreeRect,
  JitterSpec,
  NotPlacedItem,
  OrientPolicy,
  Orientation,
  PackBudgets,
  PackRequest,
  PackResult,
  PlacedItem,
  Rng,
  Trial,
  TrialRun,
} from '../model/types.ts';

/**
 * Jitter with a live random source.
 * One generator per trial, so the random stream is shared by all candidate
 * scores of that trial and stays reproducible.
 */
interface ActiveJitter {
  rnd: Rng;
  amount: number;
}

/**
 * Split free rectangles around a placed item (port of raspSplitFreeRects).
 *
 * Every free rectangle that intersects the inflated item box is replaced by
 * up to four guillotine slabs: left, right, top and bottom. Rectangles that do
 * not intersect survive untouched, and a rectangle fully covered by the item
 * is dropped. `newFree` is the leftover strip to the right of the item; it is
 * appended only when no surviving rectangle already contains it, which keeps
 * the free list free of duplicates.
 *
 * The item box is inflated by `item.gap` on every side, so the technology gap
 * is reserved together with the part itself.
 */
function raspSplitFreeRects(
  free: readonly FreeRect[],
  item: FreeRect & { gap: number },
  newFree: FreeRect,
): FreeRect[] {
  const kept: FreeRect[] = [];
  const pad = item.gap || 0;
  const ix1 = item.x - pad;
  const iy1 = item.y - pad;
  const ix2 = item.x + item.w + pad;
  const iy2 = item.y + item.h + pad;

  for (let i = 0; i < free.length; i += 1) {
    const r = free[i];
    const rx2 = r.x + r.w;
    const ry2 = r.y + r.h;

    // No intersection: the rectangle stays as is.
    if (
      ix2 <= r.x + RASP_EPS ||
      ix1 >= rx2 - RASP_EPS ||
      iy2 <= r.y + RASP_EPS ||
      iy1 >= ry2 - RASP_EPS
    ) {
      kept.push(r);
      continue;
    }

    // The item covers the whole rectangle: nothing is left to keep.
    if (
      ix1 <= r.x + RASP_EPS &&
      iy1 <= r.y + RASP_EPS &&
      ix2 >= rx2 - RASP_EPS &&
      iy2 >= ry2 - RASP_EPS
    ) {
      continue;
    }

    if (ix1 > r.x + RASP_EPS) kept.push({ x: r.x, y: r.y, w: ix1 - r.x, h: r.h });
    if (ix2 < rx2 - RASP_EPS) kept.push({ x: ix2, y: r.y, w: rx2 - ix2, h: r.h });
    if (iy1 > r.y + RASP_EPS) kept.push({ x: r.x, y: r.y, w: r.w, h: iy1 - r.y });
    if (iy2 < ry2 - RASP_EPS) kept.push({ x: r.x, y: iy2, w: r.w, h: ry2 - iy2 });
  }

  if (newFree.w > RASP_EPS && newFree.h > RASP_EPS) {
    let contained = false;
    for (let k = 0; k < kept.length; k += 1) {
      const q = kept[k];
      if (
        newFree.x >= q.x - RASP_EPS &&
        newFree.y >= q.y - RASP_EPS &&
        newFree.x + newFree.w <= q.x + q.w + RASP_EPS &&
        newFree.y + newFree.h <= q.y + q.h + RASP_EPS
      ) {
        contained = true;
        break;
      }
    }
    if (!contained) kept.push(newFree);
  }

  return kept;
}

/**
 * Place the chosen item and refresh the free list (port of raspPlaceItem).
 *
 * `placed` and `remain` are updated in place, exactly like the prototype;
 * the returned object carries the new free list and the remaining count.
 */
function raspPlaceItem(
  placed: PlacedItem[],
  remain: Record<number, number>,
  free: FreeRect[],
  typeIndex: number,
  item: Orientation & { x: number; y: number; gap: number },
  remaining: number,
  rect: FreeRect,
): { free: FreeRect[]; remaining: number } {
  const pad = item.gap || 0;
  placed.push({ typeIndex, x: item.x, y: item.y, w: item.w, h: item.h, rotated: item.rotated });
  remain[typeIndex] -= 1;

  const next = raspSplitFreeRects(
    free,
    { x: item.x, y: item.y, w: item.w, h: item.h, gap: item.gap },
    { x: item.x + item.w + pad, y: item.y, w: rect.w - item.w - pad, h: item.h },
  );

  return { free: next, remaining: remaining - 1 };
}

/**
 * Rank one candidate placement (port of raspScoreFit).
 *
 * Prefers the larger part and the tighter host rectangle: item area dominates,
 * relative fill adds a bonus, absolute unused area subtracts a small penalty.
 * Jitter multiplies the score by (1 +- amount/2), so trials explore different
 * picks while staying deterministic.
 */
function raspScoreFit(item: Orientation, rect: FreeRect, jitter: ActiveJitter | null): number {
  const freeArea = rect.w * rect.h;
  const itemArea = item.w * item.h;
  const fill = freeArea > 0 ? itemArea / freeArea : 0;
  const unused = freeArea - itemArea;
  let score = itemArea + fill * 1000 - unused * 0.001;
  if (jitter) score *= 1 + (jitter.rnd() - 0.5) * jitter.amount;
  return score;
}

/**
 * Decide whether a candidate beats the current best (port of
 * raspCompareCandidates).
 *
 * Order: larger item area, then tighter free rectangle, then higher score.
 * All comparisons are epsilon-tolerant so float noise does not flip the pick.
 */
function raspCompareCandidates(
  itemArea: number,
  freeArea: number,
  score: number,
  best: Candidate | null,
): boolean {
  if (!best) return true;
  if (itemArea > best.itemArea + RASP_EPS) return true;
  if (itemArea < best.itemArea - RASP_EPS) return false;
  if (freeArea < best.freeArea - RASP_EPS) return true;
  if (freeArea > best.freeArea + RASP_EPS) return false;
  return score > best.score;
}

/**
 * One greedy pass over the sheet (port of raspPackTrial).
 *
 * Parts are considered largest-first; for every part and every free rectangle
 * both allowed orientations are scored, and the best candidate is placed until
 * nothing fits or the budget runs out. The free list is trimmed once it
 * exceeds the hard limit: tiny rectangles are dropped, then the largest ones
 * are kept (port of raspTrimFree, which is only used here).
 *
 * `budgetIn` caps candidate checks for this trial; it defaults to the
 * per-trial budget and never exceeds the caller's remaining total.
 */

function raspPackTrial(
  expanded: readonly ExpandedPart[],
  gap: number,
  workW: number,
  workH: number,
  jitter: JitterSpec | null,
  budgets: PackBudgets,
  budgetIn: number = budgets.evalsPerTrial,
): TrialRun {
  const order = expanded.slice().sort((a, b) => b.area - a.area);

  let free: FreeRect[] = [{ x: 0, y: 0, w: workW, h: workH }];
  const placed: PlacedItem[] = [];
  let remaining = 0;
  const remainByType: Record<number, number> = {};
  for (let i = 0; i < order.length; i += 1) {
    remainByType[order[i].typeIndex] = order[i].qty;
    remaining += order[i].qty;
  }

  // One generator per trial keeps jittered scores reproducible for a seed.
  const activeJitter: ActiveJitter | null = jitter
    ? { rnd: makeRng(jitter.seed), amount: jitter.amount }
    : null;

  let guard = 0;
  let budget = budgetIn;
  const budgetStart = budget;

  while (remaining > 0 && guard < 5000 && budget > 0) {
    guard += 1;
    let best: Candidate | null = null;

    for (let oi = 0; oi < order.length && budget > 0; oi += 1) {
      const part = order[oi];
      if (remainByType[part.typeIndex] <= 0) continue;

      const orientations: Orientation[] = [{ w: part.L, h: part.W, rotated: false }];
      if (part.rotatable && Math.abs(part.L - part.W) > RASP_EPS) {
        orientations.push({ w: part.W, h: part.L, rotated: true });
      }

      for (let fi = 0; fi < free.length; fi += 1) {
        const rect = free[fi];
        if (rect.w < 1 || rect.h < 1) continue;
        const freeArea = rect.w * rect.h;

        for (let or = 0; or < orientations.length; or += 1) {
          const o = orientations[or];
          budget -= 1;
          if (o.w > rect.w + RASP_EPS || o.h > rect.h + RASP_EPS) continue;

          const itemArea = o.w * o.h;
          const score = raspScoreFit(o, rect, activeJitter);
          if (raspCompareCandidates(itemArea, freeArea, score, best)) {
            best = {
              score,
              itemArea,
              freeArea,
              part,
              rect,
              item: { x: rect.x, y: rect.y, w: o.w, h: o.h, rotated: o.rotated, gap },
            };
          }
        }
      }
    }

    if (!best) break;

    const upd = raspPlaceItem(
      placed,
      remainByType,
      free,
      best.part.typeIndex,
      best.item,
      remaining,
      best.rect,
    );
    free = upd.free;
    remaining = upd.remaining;

    // Port of raspTrimFree: keep only usable rectangles, then cap the list.
    if (free.length > budgets.freeHardLimit) {
      const useful = free.filter(
        (r) => r.w >= 1 && r.h >= 1 && r.w * r.h >= budgets.freeMinArea,
      );
      free =
        useful.length <= budgets.freeHardLimit
          ? useful
          : useful.sort((a, b) => b.w * b.h - a.w * a.h).slice(0, budgets.freeHardLimit);
    }
  }

  let maxX = 0;
  let maxY = 0;
  let usedArea = 0;
  for (let k = 0; k < placed.length; k += 1) {
    maxX = Math.max(maxX, placed[k].x + placed[k].w);
    maxY = Math.max(maxY, placed[k].y + placed[k].h);
    usedArea += placed[k].w * placed[k].h;
  }

  return {
    placed,
    counts: remainByType,
    maxX,
    maxY,
    placedCount: placed.length,
    usedArea,
    evals: budgetStart - budget,
  };
}

/**
 * Apply the orientation policy to every part type (port of
 * raspExpandOrientPolicy).
 *
 * Policy value 0 keeps the size as given, 1 flips it. Parts that cannot be
 * rotated keep their input orientation. Only L/W change; area stays the same.
 */
function raspExpandOrientPolicy(
  valid: readonly ExpandedPart[],
  policy: OrientPolicy,
): ExpandedPart[] {
  const expanded: ExpandedPart[] = [];

  for (let i = 0; i < valid.length; i += 1) {
    const v = valid[i];
    const p: 0 | 1 = policy[v.typeIndex] ?? 0;
    let L = v.L;
    let W = v.W;

    if (v.rotatable) {
      if (L >= W) {
        if (p === 1) {
          L = v.W;
          W = v.L;
        }
      } else if (p === 0) {
        L = v.W;
        W = v.L;
      }
    }

    expanded.push({
      partId: v.partId,
      name: v.name,
      typeIndex: v.typeIndex,
      L,
      W,
      qty: v.qty,
      area: v.area,
      rotatable: v.rotatable,
      color: v.color,
    });
  }

  return expanded;
}

/**
 * Build the deterministic trial list (port of raspBuildTrialList).
 *
 * Base trials: all as given, all flipped, one flip per largest type (and the
 * mirror set), then a few seeded random policies. Remaining slots are filled
 * with jittered copies of the base trials. The list is cut to `limit`, so the
 * order matters and must stay stable.
 */
function raspBuildTrialList(valid: readonly ExpandedPart[], limit: number): Trial[] {
  const trials: Trial[] = [];
  const n = valid.length;

  const base: OrientPolicy = {};
  for (let i = 0; i < n; i += 1) base[valid[i].typeIndex] = 0;
  trials.push({ policy: base, jitter: null });

  const vert: OrientPolicy = {};
  for (let i = 0; i < n; i += 1) vert[valid[i].typeIndex] = 1;
  trials.push({ policy: vert, jitter: null });

  const byArea = valid.slice().sort((a, b) => b.area - a.area);
  const flips = Math.min(byArea.length, 6);

  for (let k = 0; k < flips; k += 1) {
    const pol: OrientPolicy = {};
    for (let i = 0; i < n; i += 1) pol[valid[i].typeIndex] = 0;
    pol[byArea[k].typeIndex] = 1;
    trials.push({ policy: pol, jitter: null });
  }

  for (let k = 0; k < flips; k += 1) {
    const pol: OrientPolicy = {};
    for (let i = 0; i < n; i += 1) pol[valid[i].typeIndex] = 1;
    pol[byArea[k].typeIndex] = 0;
    trials.push({ policy: pol, jitter: null });
  }

  const rng = makeRng(POLICY_SEED);
  const randomTrials = Math.min(5, Math.max(2, Math.floor(limit / 4)));
  for (let k = 0; k < randomTrials; k += 1) {
    const rp: OrientPolicy = {};
    for (let i = 0; i < n; i += 1) rp[valid[i].typeIndex] = rng() > 0.5 ? 1 : 0;
    trials.push({ policy: rp, jitter: null });
  }

  const baseTrials = trials.length;
  for (let k = 0; k < baseTrials; k += 1) {
    if (trials.length >= limit) break;
    trials.push({
      policy: trials[k].policy,
      jitter: { seed: jitterSeed(k), amount: jitterAmount(k) },
    });
  }

  return trials.slice(0, limit);
}

/** Geometry-only guillotine placement: type indices are assigned later. */
interface GuillotineItem {
  x: number;
  y: number;
  w: number;
  h: number;
  rotated: boolean;
}

interface GuillotineGridNode {
  kind: 'grid';
  count: number;
  w: number;
  h: number;
  ow: number;
  oh: number;
}

interface GuillotineVCutNode {
  kind: 'vcut';
  count: number;
  w: number;
  h: number;
  x: number;
  left: GuillotineNode;
  right: GuillotineNode;
}

interface GuillotineHCutNode {
  kind: 'hcut';
  count: number;
  w: number;
  h: number;
  y: number;
  bottom: GuillotineNode;
  top: GuillotineNode;
}

type GuillotineNode = GuillotineGridNode | GuillotineVCutNode | GuillotineHCutNode;

/**
 * Exact guillotine layout for a single part size (port of
 * raspGuillotineLayout).
 *
 * The sheet is cut recursively at positions that are multiples of the part
 * pitch; a memoised DP picks the split with the highest count. Used as a
 * fallback for same-size sets, where it often beats the greedy packer.
 * Returns null when nothing fits or the DP would be too expensive.
 */
function raspGuillotineLayout(
  a: number,
  b: number,
  gap: number,
  workW: number,
  workH: number,
  allowRotate: boolean,
  qty: number,
): { placed: GuillotineItem[]; count: number } | null {
  const memo: Record<string, GuillotineNode> = {};

  function countIn(size: number, available: number): number {
    if (size > available + RASP_EPS) return 0;
    return Math.floor((available + gap + RASP_EPS) / (size + gap));
  }

  function cutPositions(limit: number): number[] {
    const steps = [a + gap];
    if (allowRotate) steps.push(b + gap);

    const set: Record<number, boolean> = {};
    set[0] = true;
    let changed = true;

    while (changed) {
      changed = false;
      for (const key in set) {
        for (let s = 0; s < steps.length; s += 1) {
          const v = Number(key) + steps[s];
          if (v < limit - RASP_EPS && !set[v]) {
            set[v] = true;
            changed = true;
          }
        }
      }
    }

    return Object.keys(set)
      .map(Number)
      .sort((x, y) => x - y);
  }

  const cutsW = cutPositions(workW);
  const cutsH = cutPositions(workH);
  if (cutsW.length * cutsH.length > 20000) return null;

  function solve(w: number, h: number): GuillotineNode {
    const key = round2(w) + '|' + round2(h);
    if (memo[key]) return memo[key];

    let node: GuillotineNode = {
      kind: 'grid',
      count: countIn(a, w) * countIn(b, h),
      w,
      h,
      ow: a,
      oh: b,
    };

    if (allowRotate) {
      const alt: GuillotineNode = {
        kind: 'grid',
        count: countIn(b, w) * countIn(a, h),
        w,
        h,
        ow: b,
        oh: a,
      };
      if (alt.count > node.count) node = alt;
    }

    for (let i = 0; i < cutsW.length; i += 1) {
      const x = cutsW[i];
      if (x <= RASP_EPS || x >= w - RASP_EPS) continue;

      const left = solve(x, h);
      const right = solve(Math.max(0, w - x - gap), h);
      if (left.count + right.count > node.count) {
        node = {
          kind: 'vcut',
          count: left.count + right.count,
          w,
          h,
          x,
          left,
          right,
        };
      }
    }

    for (let i = 0; i < cutsH.length; i += 1) {
      const y = cutsH[i];
      if (y <= RASP_EPS || y >= h - RASP_EPS) continue;

      const bottom = solve(w, y);
      const top = solve(w, Math.max(0, h - y - gap));
      if (bottom.count + top.count > node.count) {
        node = {
          kind: 'hcut',
          count: bottom.count + top.count,
          w,
          h,
          y,
          bottom,
          top,
        };
      }
    }

    memo[key] = node;
    return node;
  }

  const root = solve(workW, workH);
  if (!root.count) return null;

  const placed: GuillotineItem[] = [];
  const limit = Math.max(0, qty || root.count);

  function emit(node: GuillotineNode, ox: number, oy: number): void {
    if (!node || node.count <= 0 || placed.length >= limit) return;

    if (node.kind === 'grid') {
      const nx = countIn(node.ow, node.w);
      const ny = countIn(node.oh, node.h);
      for (let j = 0; j < ny; j += 1) {
        for (let i = 0; i < nx; i += 1) {
          if (placed.length >= limit) return;
          placed.push({
            x: ox + i * (node.ow + gap),
            y: oy + j * (node.oh + gap),
            w: node.ow,
            h: node.oh,
            rotated: Math.abs(node.ow - a) > RASP_EPS,
          });
        }
      }
      return;
    }

    if (node.kind === 'vcut') {
      emit(node.left, ox, oy);
      emit(node.right, ox + node.x + gap, oy);
      return;
    }

    emit(node.bottom, ox, oy);
    emit(node.top, ox, oy + node.y + gap);
  }

  emit(root, 0, 0);
  return { placed, count: placed.length };
}

export function packParts(request: PackRequest): PackResult {
  const t0 = systemClock.now();

  const { sheetL, sheetW, margin, flap, gap } = request.sheet;
  const allowRotate = !!request.sheet.allowRotate;
  const parts = request.parts ?? [];
  const budgets: PackBudgets = { ...DEFAULT_BUDGETS, ...request.budgets };

  const workW = sheetL - margin * 2;
  const workH = sheetW - flap - margin - margin;
  const workArea = Math.max(0, workW) * Math.max(0, workH);

  if (parts.length === 0) {
    return { ok: false, error: 'add at least one part' };
  }
  if (workW <= RASP_EPS || workH <= RASP_EPS) {
    return { ok: false, error: 'work area is not positive: reduce margin or flap' };
  }

  const valid: ExpandedPart[] = [];
  const oversized: NotPlacedItem[] = [];
  const badInput: string[] = [];
  let totalRequested = 0;

  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i];
    const L = Number(p.L);
    const W = Number(p.W);
    let qty = Math.floor(Number(p.qty) || 0);
    const name = p.name || 'Part ' + (i + 1);

    if (!(L > 0) || !(W > 0)) {
      badInput.push(name + ': size must be positive');
      continue;
    }
    if (!(qty >= 1)) qty = 1;
    totalRequested += qty;

    const rotatable = allowRotate && p.rotatable !== false;
    const fits0 = L <= workW + RASP_EPS && W <= workH + RASP_EPS;
    const fits90 = rotatable && W <= workW + RASP_EPS && L <= workH + RASP_EPS;

    if (!fits0 && !fits90) {
      oversized.push({ partId: p.id, name, reason: 'oversized' });
      continue;
    }

    valid.push({
      partId: p.id,
      name,
      typeIndex: i,
      L,
      W,
      qty,
      area: L * W,
      rotatable,
      color: p.color ?? paletteFor(i),
    });
  }

  if (badInput.length) {
    return { ok: false, error: badInput.join('; ') };
  }
  if (valid.length === 0) {
    return {
      ok: false,
      error: 'no part fits the working area',
      notPlaced: oversized,
      oversized,
    };
  }
  const trialLimit = trialLimitFor(totalRequested, budgets.maxTrials);
  const trialList = raspBuildTrialList(valid, trialLimit);
  let best: TrialRun | null = null;
  let totalBudgetLeft = budgets.evalsTotal;
  let trialsDone = 0;

  for (let t = 0; t < trialList.length; t += 1) {
    if (totalBudgetLeft <= 0) break;

    const trialBudget = Math.min(budgets.evalsPerTrial, totalBudgetLeft);
    const tr = trialList[t];
    const expanded = raspExpandOrientPolicy(valid, tr.policy);
    const run = raspPackTrial(expanded, gap, workW, workH, tr.jitter, budgets, trialBudget);
    totalBudgetLeft -= run.evals;
    trialsDone += 1;

    if (
      !best ||
      run.placedCount > best.placedCount ||
      (run.placedCount === best.placedCount && run.usedArea > best.usedArea + RASP_EPS) ||
      (run.placedCount === best.placedCount &&
        Math.abs(run.usedArea - best.usedArea) < RASP_EPS &&
        run.maxY < best.maxY - RASP_EPS)
    ) {
      best = run;
    }

    if (best && best.usedArea >= workArea - 1e-6) break;
  }

  // Same-size sets also get an exact guillotine pass, which often wins.
  let sameSize = true;
  for (let sv = 1; sv < valid.length; sv += 1) {
    if (
      Math.abs(valid[sv].L - valid[0].L) > RASP_EPS ||
      Math.abs(valid[sv].W - valid[0].W) > RASP_EPS
    ) {
      sameSize = false;
      break;
    }
  }

  let usedGuillotine = false;

  if (sameSize) {
    const guill = raspGuillotineLayout(
      valid[0].L,
      valid[0].W,
      gap,
      workW,
      workH,
      valid[0].rotatable,
      totalRequested,
    );

    if (guill && guill.placed.length > (best ? best.placedCount : 0)) {
      const leftToPlace = valid.map((v) => v.qty);
      const gPlaced: PlacedItem[] = [];
      const gCounts: Record<number, number> = {};
      for (let v = 0; v < valid.length; v += 1) {
        gCounts[valid[v].typeIndex] = valid[v].qty;
      }

      let gMaxX = 0;
      let gMaxY = 0;
      let gArea = 0;

      for (let gp = 0; gp < guill.placed.length; gp += 1) {
        let gti = -1;
        for (let lk = 0; lk < leftToPlace.length; lk += 1) {
          if (leftToPlace[lk] > 0) {
            gti = lk;
            break;
          }
        }
        if (gti < 0) break;

        leftToPlace[gti] -= 1;
        gCounts[valid[gti].typeIndex] -= 1;
        const gr = guill.placed[gp];
        gPlaced.push({
          typeIndex: valid[gti].typeIndex,
          x: gr.x,
          y: gr.y,
          w: gr.w,
          h: gr.h,
          rotated: gr.rotated,
        });
        gMaxX = Math.max(gMaxX, gr.x + gr.w);
        gMaxY = Math.max(gMaxY, gr.y + gr.h);
        gArea += gr.w * gr.h;
      }

      if (gPlaced.length && validateLayout(gPlaced, workW, workH, gap).length === 0) {
        best = {
          placed: gPlaced,
          counts: gCounts,
          maxX: gMaxX,
          maxY: gMaxY,
          placedCount: gPlaced.length,
          evals: 0,
          usedArea: gArea,
        };
        usedGuillotine = true;
      }
    }
  }

  if (!best || best.placed.length === 0) {
    return { ok: false, error: 'no part could be placed on the sheet' };
  }

  const warnings = validateLayout(best.placed, workW, workH, gap);
  if (warnings.length) {
    return {
      ok: false,
      error: 'internal layout error: ' + warnings[0],
      warnings,
    };
  }

  const byType: ByTypeItem[] = [];
  for (let s = 0; s < valid.length; s += 1) {
    const vt = valid[s];
    const placedCnt = best.placed.filter((pl) => pl.typeIndex === vt.typeIndex).length;
    const missing = Math.max(0, vt.qty - placedCnt);
    byType.push({
      partId: vt.partId,
      name: vt.name,
      typeIndex: vt.typeIndex,
      color: vt.color,
      requested: vt.qty,
      placed: placedCnt,
      missing,
      sheets: placedCnt > 0 ? Math.ceil(vt.qty / placedCnt) : null,
      L: vt.L,
      W: vt.W,
    });
  }

  const notPlaced: NotPlacedItem[] = oversized.slice();
  for (let b = 0; b < byType.length; b += 1) {
    if (byType[b].missing > 0) {
      notPlaced.push({
        partId: byType[b].partId,
        name: byType[b].name,
        reason: 'noSpace',
      });
    }
  }

  let usedArea = 0;
  for (let u = 0; u < best.placed.length; u += 1) {
    usedArea += best.placed[u].w * best.placed[u].h;
  }

  const sheetArea = sheetL * sheetW;
  let sheetsForOrder = 1;
  for (let sh = 0; sh < byType.length; sh += 1) {
    if (byType[sh].sheets) sheetsForOrder = Math.max(sheetsForOrder, byType[sh].sheets);
  }

  return {
    ok: true,
    placed: best.placed,
    byType,
    notPlaced,
    oversized,
    warnings: [],
    workW: Math.max(0, workW),
    workH: Math.max(0, workH),
    workArea,
    sheetArea,
    usedArea,
    wasteArea: Math.max(0, sheetArea - usedArea),
    utilizationWork: workArea > 0 ? (usedArea / workArea) * 100 : 0,
    utilizationSheet: sheetArea > 0 ? (usedArea / sheetArea) * 100 : 0,
    bounds: { w: best.maxX, h: best.maxY },
    placedCount: best.placed.length,
    requestedCount: totalRequested,
    sheetsForOrder,
    trials: trialsDone,
    engine: usedGuillotine ? 'guillotine' : 'maxrects',
    ms: systemClock.now() - t0,
  };
}
