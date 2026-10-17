/**
 * Public surface of the layout engine.
 * UI and hooks import from here only, never from individual modules.
 */
export { packParts } from './packParts.ts';
export { gridLayout } from './gridLayout.ts';
export { validateLayout, rectContains } from './validate.ts';
