/* =========================================================================
 * TrendCard (.card) — month-over-month or plant comparison. Port of
 * renderTrend(): buildTrendPlot(history, filters, orient, sel, ytdYear,
 * standards, {chartKind, seriesBy}). The H/V toggle here is locked to the
 * sidebar Position filter when that is set.
 * ========================================================================= */
import { CFLogic } from '../lib/shared';
import { activeFilters, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';
import PlotlyChart from './PlotlyChart';
import Seg from './Seg';

interface Props {
  history: History;
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
}

export default function TrendCard({ history, filters: S, update }: Props) {
  let sel = CFLogic.sortedMonthKeys(history)
    .filter((k: string) => S.trendSel[k])
    .map((k: string) => ({ key: k, label: CFLogic.keyToLabel(k) }));

  if (S.trendBy === 'plant' && !sel.length && S.monthKey) {
    sel = [{ key: S.monthKey, label: CFLogic.keyToLabel(S.monthKey) }];
  }

  const ytdYear = S.ytd && S.monthKey && S.trendBy === 'month' ? Number(S.monthKey.slice(0, 4)) : null;
  const lockOrient = S.orient !== 'Both';
  const orient = lockOrient ? S.orient : S.trendOrient;

  const p = CFLogic.buildTrendPlot(history, activeFilters(S), orient, sel, ytdYear, history.standards, {
    chartKind: S.trendKind,
    seriesBy: S.trendBy,
  });

  const empty =
    S.trendBy === 'plant'
      ? 'No plant data for this selection.'
      : 'Pick months (or YTD) above to compare against the current month.';

  return (
    <section className="card">
      <div className="chead">
        <h2>Month-over-month trend</h2>
        <span className="spacer" />
        <Seg
          ariaLabel="Trend position"
          style={{ width: 200 }}
          disabled={lockOrient}
          value={orient}
          onChange={(v) => update({ trendOrient: v as 'H' | 'V' })}
          options={[
            { v: 'H', label: 'Horizontal' },
            { v: 'V', label: 'Vertical' },
          ]}
        />
      </div>
      <PlotlyChart plot={p} orient={orient} emptyHtml={`<div class="empty">${empty}</div>`} />
    </section>
  );
}
