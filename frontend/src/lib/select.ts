/* =========================================================================
 * Pure selection helpers — direct ports of the prototype's periodKeys(),
 * activeFilters(), currentRecords(), computePreset(), periodLabel(),
 * plantsLabel(). All analytics stay in @cf-wavescan/shared (CFLogic).
 * ========================================================================= */
import { CFLogic } from './shared';
import type { Filters } from '../hooks/useFilters';

export interface History {
  app: string;
  schema: any;
  savedAt: string | null;
  standards: any;
  months: Record<string, { label: string; files: string[]; records: any[] }>;
}

export function setOf(arr: string[]): Record<string, boolean> {
  const o: Record<string, boolean> = {};
  arr.forEach((k) => (o[k] = true));
  return o;
}

export function activeFilters(f: Filters) {
  return { model: f.model, plants: f.plantSel, file: f.fileSel, colors: f.colorsSel };
}

export function periodKeys(history: History, f: Filters): string[] {
  if (!f.monthKey) return [];
  if (!f.periodSel) return [f.monthKey];
  const keys = CFLogic.sortedMonthKeys(history).filter((k: string) => f.periodSel![k]);
  return keys.length ? keys : [f.monthKey];
}

export function currentRecords(history: History, f: Filters): any[] {
  return CFLogic.periodRecords(history, periodKeys(history, f), activeFilters(f));
}

export function computePreset(history: History, f: Filters, preset: string): Record<string, boolean> | null {
  const keys = CFLogic.sortedMonthKeys(history);
  if (!keys.length || preset === 'single') return null;
  const anchor = f.monthKey && keys.indexOf(f.monthKey) !== -1 ? f.monthKey : keys[keys.length - 1];
  const ai = keys.indexOf(anchor);
  let picked: string[];
  if (preset === 'all') picked = keys;
  else if (preset === 'ytd') {
    const yr = anchor.slice(0, 4);
    picked = keys.filter((k: string) => k.slice(0, 4) === yr && k <= anchor);
  } else {
    const n = Number(preset) || 1;
    picked = keys.slice(Math.max(0, ai - n + 1), ai + 1);
  }
  return picked.length > 1 ? setOf(picked) : null;
}

export function periodLabel(history: History, f: Filters): string {
  const ks = periodKeys(history, f);
  if (!ks.length) return 'No data';
  if (ks.length === 1) return CFLogic.keyToLabel(ks[0]);
  return CFLogic.keyToLabel(ks[0]) + ' – ' + CFLogic.keyToLabel(ks[ks.length - 1]) + ' (' + ks.length + ' months)';
}

export function plantsLabel(f: Filters): string {
  if (!f.plantSel) return 'All plants';
  const on = Object.keys(f.plantSel).filter((k) => f.plantSel![k]);
  return on.length ? on.join(' + ') : 'All plants';
}
