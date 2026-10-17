/**
 * Multi-part layout orchestrator (port of raspPackParts).
 *
 * NOT IMPLEMENTED YET. The body throws on purpose: the test suite in
 * __tests__/packParts.spec.ts must stay red until the port is complete.
 * Do not replace this with a silent fallback: a wrong number is worse than
 * a loud failure, because sheet counts go straight into pricing.
 */
import type { PackRequest, PackResult } from '../model/types.ts';

export function packParts(request: PackRequest): PackResult {
  void request;
  throw new Error('packParts is not implemented yet');
}
