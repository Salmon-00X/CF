/* =========================================================================
 * DetailCard (.card) — per-color zone table + point-by-point compare. Port of
 * renderDetail() / renderZonePicker() / renderDetailCompare() / kpi().
 * ========================================================================= */
import { CFCore, CFLogic } from '../lib/shared';
import { currentRecords, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';
import PlotlyChart from './PlotlyChart';

interface Props {
  history: History;
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
}

function devClass(d: number | null) {
  if (d === null || d === undefined || isNaN(d)) return '';
  return d >= 0 ? 'pos' : 'neg';
}

function Kpi({ title, g }: { title: string; g: any }) {
  return (
    <div className="kpi">
      <div className="t">{title}</div>
      <div className="v num">
        {g ? (
          <>
            {CFCore.fmtCF(g.avg)}
            <span className={'pill ' + (g.status || 'NA')}>{g.status || '—'}</span>
          </>
        ) : (
          '—'
        )}
      </div>
      <div className="hint">{g ? `Ford ${g.ford} · Min ${g.minStd} · n=${g.n}` : 'No readings.'}</div>
    </div>
  );
}

export default function DetailCard({ history, filters: S, update }: Props) {
  const recs = currentRecords(history, S);
  const colors: string[] = CFLogic.colorsIn(recs);
  const color = S.detailColor && colors.indexOf(S.detailColor) !== -1 ? S.detailColor : colors[0] || null;
  const std = history.standards;

  const crecs = color ? recs.filter((r: any) => r.color === color) : [];
  const a = color ? CFCore.analyze(crecs, std) : { groups: [] };
  const H = a.groups.find((g: any) => g.orient === 'H');
  const V = a.groups.find((g: any) => g.orient === 'V');
  const zs = color
    ? CFCore.zoneStatuses(crecs, std).sort((x: any, y: any) =>
        x.zone.localeCompare(y.zone, undefined, { numeric: true })
      )
    : [];

  // Zones for the picker
  const zones: string[] = [];
  const seen: Record<string, boolean> = {};
  crecs.forEach((r: any) => {
    if (!seen[r.zone]) {
      seen[r.zone] = true;
      zones.push(r.zone);
    }
  });
  zones.sort((p, q) => p.localeCompare(q, undefined, { numeric: true }));

  const on = S.zoneSel;
  const active = on ? Object.keys(on).filter((z) => on[z]) : [];
  const pickSummary = !on
    ? 'All checkzones'
    : active.length === 0
    ? 'No zones selected (showing all)'
    : active.length === zones.length
    ? 'All checkzones'
    : active.length + ' selected';

  function toggleZone(z: string) {
    let sel = S.zoneSel ? { ...S.zoneSel } : null;
    if (!sel) {
      sel = {};
      zones.forEach((zz) => (sel![zz] = true));
    }
    sel[z] = !sel[z];
    const next = zones.every((zz) => sel![zz]) ? null : sel;
    update({ zoneSel: next });
  }

  function preset(kind: 'all' | 'none' | 'failonly') {
    if (kind === 'all') return update({ zoneSel: null });
    if (kind === 'none') {
      const o: Record<string, boolean> = {};
      zones.forEach((z) => (o[z] = false));
      return update({ zoneSel: o });
    }
    // failing only
    const failing = new Set(
      CFCore.zoneStatuses(crecs, std)
        .filter((z: any) => z.status === 'FAIL')
        .map((z: any) => z.zone)
    );
    const o: Record<string, boolean> = {};
    zones.forEach((z) => (o[z] = failing.has(z)));
    update({ zoneSel: o });
  }

  // Zone-compare chart selection (trend months + current month).
  let sel = CFLogic.sortedMonthKeys(history)
    .filter((k: string) => S.trendSel[k])
    .map((k: string) => ({ key: k, label: CFLogic.keyToLabel(k) }));
  if (S.monthKey && !sel.some((m: any) => m.key === S.monthKey)) {
    sel.unshift({ key: S.monthKey, label: CFLogic.keyToLabel(S.monthKey) });
  }
  const comparePlot = color
    ? CFLogic.buildZoneCompare(
        history,
        { model: S.model, plants: S.plantSel, file: S.fileSel },
        color,
        sel,
        std,
        { seriesBy: S.trendBy, zones: S.zoneSel }
      )
    : null;

  return (
    <section className="card">
      <div className="detailbar">
        <h2 style={{ margin: 0, fontSize: '14.5px', color: 'var(--ford-900)' }}>Checkzone detail</h2>
        <span className="spacer" />
        <label className="eyebrow" htmlFor="detailColor">
          Color
        </label>
        <select
          id="detailColor"
          aria-label="Detail color"
          value={color || ''}
          onChange={(e) => update({ detailColor: e.target.value })}
        >
          {colors.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {!color ? (
        <div className="empty">No readings for this selection.</div>
      ) : (
        <>
          <div className="kpis">
            <Kpi title="Horizontal avg" g={H} />
            <Kpi title="Vertical avg" g={V} />
          </div>
          <div className="tscroll">
            <table className="zones">
              <thead>
                <tr>
                  <th>Checkzone</th>
                  <th>Position</th>
                  <th>Model</th>
                  <th className="r">CF</th>
                  <th className="r">Δ Ford</th>
                  <th className="r">Δ Min</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {zs.map((z: any, i: number) => (
                  <tr key={i}>
                    <td className="num">{z.zone}</td>
                    <td>{z.orient === 'H' ? 'Horizontal' : 'Vertical'}</td>
                    <td>{CFCore.modelLabel(z.model)}</td>
                    <td className="r num">{CFCore.fmtCF(z.cf)}</td>
                    <td className={'r num dev ' + devClass(z.devFord)}>{CFLogic.fmtDelta(z.devFord)}</td>
                    <td className={'r num dev ' + devClass(z.devMin)}>{CFLogic.fmtDelta(z.devMin)}</td>
                    <td>
                      <span className={'pill ' + (z.status || 'NA')}>{z.status || 'No standard'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="chead" style={{ marginTop: 14 }}>
            <h2>Checkzone comparison — point by point</h2>
            <span className="spacer" />
            <details className="dd" style={{ minWidth: 200 }}>
              <summary>{pickSummary}</summary>
              <div className="dd-body">
                <div className="dd-presets">
                  <button type="button" onClick={() => preset('all')}>
                    All
                  </button>
                  <button type="button" onClick={() => preset('none')}>
                    None
                  </button>
                  <button type="button" onClick={() => preset('failonly')}>
                    Failing only
                  </button>
                </div>
                <div className="dd-list">
                  {zones.length ? (
                    zones.map((z) => (
                      <label key={z}>
                        <input type="checkbox" checked={!on || !!on[z]} onChange={() => toggleZone(z)} />
                        {z}
                      </label>
                    ))
                  ) : (
                    <div className="hint">No zones for this color.</div>
                  )}
                </div>
              </div>
            </details>
            <span className="legend-key" style={{ marginLeft: 10 }}>
              <span className="k-ford">
                <i />
                Average Target
              </span>
              <span className="k-min">
                <i />
                Min. Requirement
              </span>
            </span>
          </div>
          <div className="hint" style={{ margin: '0 0 6px' }}>
            Pick specific checkzones to compare point-by-point across the months (or plants) in Trend compare. Leave
            empty for every zone.
          </div>
          <PlotlyChart
            plot={comparePlot}
            orient={'cmp'}
            emptyHtml={'<div class="empty">Pick a color to compare its checkzones point by point.</div>'}
          />
        </>
      )}
    </section>
  );
}
