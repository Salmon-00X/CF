/* =========================================================================
 * Sidebar — docked rail (drawer < 960px). Panels in order:
 * Period · Model · Position · Chart type · Plant · Colors · Trend compare.
 * Ports renderPeriod / renderPlantChips / renderColorChips / renderTrendChips.
 * ========================================================================= */
import { CFLogic } from '../lib/shared';
import { periodKeys, periodLabel, setOf, computePreset, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';
import Seg from './Seg';

interface Props {
  history: History;
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  onReset: () => void;
  navOpen: boolean;
  onClose: () => void;
}

const PERIOD_PRESETS = [
  { v: 'single', label: 'Single month' },
  { v: '3', label: 'Last 3 mo' },
  { v: '6', label: 'Last 6 mo' },
  { v: 'ytd', label: 'YTD' },
  { v: 'all', label: 'All loaded' },
];

export default function Sidebar({ history, filters: S, update, onReset }: Props) {
  const keys: string[] = CFLogic.sortedMonthKeys(history);
  const eff = setOf(periodKeys(history, S));

  // Plants available anywhere in the selected period (unfiltered pool).
  let poolRecs: any[] = [];
  periodKeys(history, S).forEach((k) => {
    const m = history.months[k];
    if (m) poolRecs = poolRecs.concat(m.records);
  });
  const plants: string[] = CFLogic.plantsIn(poolRecs);

  // Colors available under the current model/plant/file (but not the color filter).
  const colorRecs = CFLogic.periodRecords(history, periodKeys(history, S), {
    model: S.model,
    plants: S.plantSel,
    file: S.fileSel,
  });
  const colors: string[] = CFLogic.colorsIn(colorRecs);

  const trendKeys = keys.slice().reverse().slice(0, 14);

  function applyPreset(preset: string) {
    update({ periodSel: computePreset(history, S, preset), periodPreset: preset, colorsSel: null });
  }

  function toggleMonth(k: string) {
    const current = new Set(periodKeys(history, S));
    if (current.has(k)) current.delete(k);
    else current.add(k);
    let checked = Array.from(current);
    if (!checked.length && S.monthKey) checked = [S.monthKey];
    const periodSel = checked.length === 1 && checked[0] === S.monthKey ? null : setOf(checked);
    update({ periodSel, periodPreset: periodSel ? 'custom' : 'single', colorsSel: null });
  }

  function togglePlant(p: string) {
    let sel = S.plantSel ? { ...S.plantSel } : null;
    if (!sel) {
      sel = {};
      plants.forEach((x) => (sel![x] = true));
    }
    sel[p] = !sel[p];
    const next = plants.every((x) => sel![x]) ? null : sel;
    update({ plantSel: next, colorsSel: null });
  }

  function toggleColor(c: string) {
    let sel = S.colorsSel ? { ...S.colorsSel } : null;
    if (!sel) {
      sel = {};
      colors.forEach((x) => (sel![x] = true));
    }
    sel[c] = !sel[c];
    const next = colors.every((x) => sel![x]) ? null : sel;
    update({ colorsSel: next });
  }

  function toggleTrend(k: string) {
    update({ trendSel: { ...S.trendSel, [k]: !S.trendSel[k] } });
  }

  return (
    <aside className="sidebar" id="sidebar" aria-label="Filters and controls">
      <div className="side-head">
        <span className="side-title">Filters &amp; controls</span>
        <span className="spacer" />
        <button className="side-btn" type="button" title="Reset all filters" onClick={onReset}>
          ⟲
        </button>
      </div>
      <div className="side-body">
        {/* Period */}
        <div className="panel">
          <h3>Period</h3>
          <details className="dd">
            <summary>{S.periodSel ? periodLabel(history, S) : 'Current month only'}</summary>
            <div className="dd-body">
              <div className="dd-presets">
                {PERIOD_PRESETS.map((p) => (
                  <button
                    key={p.v}
                    type="button"
                    className={p.v === S.periodPreset ? 'on' : ''}
                    onClick={() => applyPreset(p.v)}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <div className="dd-list">
                {keys.length ? (
                  keys
                    .slice()
                    .reverse()
                    .map((k) => (
                      <label key={k}>
                        <input type="checkbox" checked={!!eff[k]} onChange={() => toggleMonth(k)} />
                        {CFLogic.keyToLabel(k)}
                      </label>
                    ))
                ) : (
                  <div className="hint">Upload data first.</div>
                )}
              </div>
            </div>
          </details>
          <div className="hint">Pool readings from more than one month. Default is the month shown in the app bar.</div>
        </div>

        {/* Model */}
        <div className="panel">
          <h3>Model</h3>
          <Seg
            ariaLabel="Model filter"
            value={S.model}
            onChange={(v) => update({ model: v as Filters['model'] })}
            options={[
              { v: 'Both', label: 'Both' },
              { v: 'Ranger', label: 'DBL', title: 'Ranger / DBL (double cab)' },
              { v: 'Raptor', label: 'Raptor' },
            ]}
          />
        </div>

        {/* Position */}
        <div className="panel">
          <h3>Position</h3>
          <Seg
            ariaLabel="Position filter"
            value={S.orient}
            onChange={(v) => update({ orient: v as Filters['orient'] })}
            options={[
              { v: 'Both', label: 'Both' },
              { v: 'H', label: 'Horizontal' },
              { v: 'V', label: 'Vertical' },
            ]}
          />
          <div className="hint">Horizontal = hood &amp; roof zones. Vertical = everything else.</div>
        </div>

        {/* Chart type */}
        <div className="panel">
          <h3>Chart type</h3>
          <Seg
            ariaLabel="Chart type"
            value={S.chartType}
            onChange={(v) => update({ chartType: v as Filters['chartType'] })}
            options={[
              { v: 'box', label: 'Boxplot' },
              { v: 'pareto', label: 'Pareto' },
              { v: 'interval', label: 'Ranking', title: 'Descending mean CF per color' },
            ]}
          />
          <div className="hint">Boxplot = distribution. Pareto = colors with the most off-target zones. Ranking = mean CF per color, descending.</div>
        </div>

        {/* Plant */}
        <div className="panel">
          <div className="chiprow">
            <h3 style={{ margin: 0 }}>Plant</h3>
            <button className="link" type="button" onClick={() => update({ plantSel: null, colorsSel: null })}>
              All plants
            </button>
          </div>
          <div className="chips">
            {plants.length ? (
              plants.map((p) => {
                const on = !S.plantSel || !!S.plantSel[p];
                return (
                  <button
                    key={p}
                    type="button"
                    className={'chip' + (on ? ' on' : '')}
                    aria-pressed={on}
                    onClick={() => togglePlant(p)}
                  >
                    {p}
                  </button>
                );
              })
            ) : (
              <div className="hint">No plant column in this data.</div>
            )}
          </div>
          <div className="hint">Multi-select. Pick one or several — leave empty for all.</div>
        </div>

        {/* Colors */}
        <div className="panel">
          <div className="chiprow">
            <h3 style={{ margin: 0 }}>Colors</h3>
            <button className="link" type="button" onClick={() => update({ colorsSel: null })}>
              All colors
            </button>
          </div>
          <div className="chips">
            {colors.length ? (
              colors.map((c) => {
                const on = !S.colorsSel || !!S.colorsSel[c];
                return (
                  <button
                    key={c}
                    type="button"
                    className={'chip' + (on ? ' on' : '')}
                    aria-pressed={on}
                    onClick={() => toggleColor(c)}
                  >
                    {c}
                  </button>
                );
              })
            ) : (
              <div className="hint">Load a month to filter colors.</div>
            )}
          </div>
        </div>

        {/* Trend compare */}
        <div className="panel">
          <h3>Trend compare</h3>
          <Seg
            ariaLabel="Trend series"
            style={{ marginBottom: 8 }}
            value={S.trendBy}
            onChange={(v) => update({ trendBy: v as Filters['trendBy'] })}
            options={[
              { v: 'month', label: 'Months' },
              { v: 'plant', label: 'Plants' },
            ]}
          />
          <Seg
            ariaLabel="Trend chart type"
            style={{ marginBottom: 8 }}
            value={S.trendKind}
            onChange={(v) => update({ trendKind: v as Filters['trendKind'] })}
            options={[
              { v: 'box', label: 'Boxplot' },
              { v: 'bar', label: 'Bar' },
            ]}
          />
          <div className="chips">
            {trendKeys.length ? (
              trendKeys.map((k) => {
                const on = !!S.trendSel[k];
                return (
                  <button
                    key={k}
                    type="button"
                    className={'chip month' + (on ? ' on' : '')}
                    aria-pressed={on}
                    onClick={() => toggleTrend(k)}
                  >
                    {CFLogic.keyToLabel(k)}
                  </button>
                );
              })
            ) : (
              <div className="hint">Trends appear when history holds more than one month.</div>
            )}
          </div>
          <label className="hint" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 10, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={S.ytd}
              disabled={S.trendBy === 'plant'}
              onChange={(e) => update({ ytd: e.target.checked })}
            />{' '}
            Include YTD pool (current year)
          </label>
        </div>
      </div>
    </aside>
  );
}
