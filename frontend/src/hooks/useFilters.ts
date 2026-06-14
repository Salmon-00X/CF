/* =========================================================================
 * useFilters — central UI state, mirroring the prototype's `S` object.
 * (app.js var S = {...}). Only the user-facing filter fields are reset by the
 * Reset button (DEFAULT_FILTERS).
 * ========================================================================= */
import { useCallback, useState } from 'react';

export type Model = 'Both' | 'Ranger' | 'Raptor';
export type Orient = 'Both' | 'H' | 'V';
export type ChartType = 'box' | 'pareto' | 'interval';
export type TrendKind = 'box' | 'bar';
export type TrendBy = 'month' | 'plant';
export type SelSet = Record<string, boolean> | null;

export interface Filters {
  monthKey: string | null; // app-bar "current" month — anchors period presets
  periodSel: SelSet; // null = single month; else {key:true}
  periodPreset: string; // single | 3 | 6 | ytd | all | custom
  model: Model;
  orient: Orient;
  chartType: ChartType;
  plantSel: SelSet; // null = every plant
  fileSel: string | null; // null = all files in month
  colorsSel: SelSet; // null = all colors
  trendBy: TrendBy;
  trendKind: TrendKind;
  trendOrient: 'H' | 'V'; // used when Position = Both
  trendSel: Record<string, boolean>; // {monthKey:true}
  ytd: boolean;
  zoneSel: SelSet; // null = every zone in the detail color
  detailColor: string | null;
}

export const DEFAULT_FILTERS: Partial<Filters> = {
  periodSel: null,
  periodPreset: 'single',
  model: 'Both',
  plantSel: null,
  fileSel: null,
  orient: 'Both',
  chartType: 'box',
  trendKind: 'box',
  trendBy: 'month',
  colorsSel: null,
  trendSel: {},
  ytd: false,
};

const INITIAL: Filters = {
  monthKey: null,
  periodSel: null,
  periodPreset: 'single',
  model: 'Both',
  orient: 'Both',
  chartType: 'box',
  plantSel: null,
  fileSel: null,
  colorsSel: null,
  trendBy: 'month',
  trendKind: 'box',
  trendOrient: 'H',
  trendSel: {},
  ytd: false,
  zoneSel: null,
  detailColor: null,
};

export function useFilters() {
  const [filters, setFilters] = useState<Filters>(INITIAL);

  const update = useCallback((patch: Partial<Filters>) => {
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const reset = useCallback(() => {
    setFilters((prev) => ({ ...prev, ...DEFAULT_FILTERS, trendSel: {} } as Filters));
  }, []);

  return { filters, setFilters, update, reset };
}
