/* =========================================================================
 * @cf-wavescan/shared — public type surface
 *
 * These interfaces describe the data shapes produced and consumed by the
 * (currently plain-CJS) core/logic engines. They are the typed contract the
 * backend and frontend build against. When core.js / logic.js are migrated to
 * native TypeScript (HANDOFF.md §6.A), these become their real return types.
 * ========================================================================= */

/** A single de-duplicated Wavescan measurement. `model`/`plant` may be null —
 *  null rows are wildcards in the filter, not hidden (HANDOFF.md §7.4). */
export interface Reading {
  model: string | null;
  plant: string | null;
  color: string;
  family: string;
  zone: string;
  orient: 'H' | 'V';
  cf: number;
}

/** Wavescan target/minimum pair for one color family (or per-color override),
 *  split by orientation: H = horizontal panels, V = vertical panels. */
export interface StandardRow {
  fordH: number;
  fordV: number;
  minH: number;
  minV: number;
}

/** Two-layer standards object (schema v2): family defaults plus per-color
 *  overrides. A per-color entry, when present, fully overrides its family. */
export interface Standards {
  families: Record<string, StandardRow>;
  colors: Record<string, StandardRow>;
}

/** One month of imported data in the history model. */
export interface MonthEntry {
  key: string;
  label: string;
  records: Reading[];
}
