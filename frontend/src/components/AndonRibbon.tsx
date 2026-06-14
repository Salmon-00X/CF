/* =========================================================================
 * AndonRibbon (.ribbon) — three cells: PASS / WARNING / FAIL. Port of
 * renderRibbon(): zone-off counts + month-over-month ▲/▼ flags (single month
 * only). Status comes from CFLogic.summarize → CFCore.statusOf.
 * ========================================================================= */
import { CFCore, CFLogic } from '../lib/shared';
import { activeFilters, currentRecords, periodKeys, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';

interface Props {
  history: History;
  filters: Filters;
}

function ribbonKey(g: any) {
  return [g.model || '?', g.color, g.orient].join('|');
}

export default function AndonRibbon({ history, filters: S }: Props) {
  const recs = currentRecords(history, S);
  const std = history.standards;
  const sum = CFLogic.summarize(recs, std);
  const counts = CFLogic.zoneCounts(recs, std);
  const mom =
    periodKeys(history, S).length === 1
      ? CFLogic.momDeltas(history, S.monthKey, activeFilters(S), std)
      : { prevKey: null, prevLabel: null, map: {} };

  const orientVisible = (g: any) => S.orient === 'Both' || g.orient === S.orient;

  const spec: Array<['PASS' | 'WARNING' | 'FAIL', string, string]> = [
    ['PASS', 'pass', 'Pass'],
    ['WARNING', 'warn', 'Warning'],
    ['FAIL', 'fail', 'Fail'],
  ];

  return (
    <section className="ribbon" aria-label="Status summary">
      {spec.map(([status, cls, label]) => {
        const groups = sum.byStatus[status].filter(orientVisible);
        return (
          <div className={'cell ' + cls} key={status}>
            <div className="head">
              <span className="count num">{groups.length}</span>
              <span className="lbl">{label}</span>
            </div>
            <div className="items">
              {status === 'PASS' ? (
                <div className="none">
                  {groups.length
                    ? groups
                        .map((g: any) => {
                          const pv = mom.map[ribbonKey(g)];
                          const arrow = pv === undefined ? '' : g.avg - pv >= 0 ? ' ▲' : ' ▼';
                          return g.color + ' ' + g.orient + arrow;
                        })
                        .join(' · ')
                    : 'Nothing passing yet.'}
                </div>
              ) : !groups.length ? (
                <div className="none">
                  {status === 'FAIL' ? 'No color is below the minimum.' : 'No color is in the warning band.'}
                </div>
              ) : (
                groups.map((g: any) => {
                  const zc = counts[ribbonKey(g)];
                  const pv = mom.map[ribbonKey(g)];
                  const d = pv !== undefined ? g.avg - pv : null;
                  const up = d !== null && d >= 0;
                  return (
                    <div className="item" key={ribbonKey(g)}>
                      <b>{g.color}</b>
                      <span className="tag">
                        {CFCore.modelLabel(g.model)} · {g.orient === 'H' ? 'Hor' : 'Ver'}
                      </span>
                      {zc && zc.fail + zc.warn > 0 && (
                        <span
                          className="zinfo num"
                          title={`${zc.fail} failing, ${zc.warn} in warning, of ${zc.total} checkzones`}
                        >
                          {zc.fail + zc.warn}/{zc.total} zones off
                        </span>
                      )}
                      {d !== null && (
                        <span
                          className={'delta ' + (up ? 'up' : 'down')}
                          title={`Average vs ${mom.prevLabel} (${CFLogic.fmtDelta(d)})`}
                        >
                          {(up ? '▲' : '▼') + Math.abs(Math.round(d * 10) / 10).toFixed(1)}
                        </span>
                      )}
                      <span className="num">
                        avg {CFCore.fmtCF(g.avg)} / Ford {g.ford} · Min {g.minStd}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </section>
  );
}
