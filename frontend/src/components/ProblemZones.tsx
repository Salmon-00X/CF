/* =========================================================================
 * ProblemZones (.card) — worst-offender digest. Port of renderProblems():
 * FAIL-first, then WARNING, by deepest deficit below the minimum. Row click
 * opens that color in the detail card. Status from CFLogic.problemZones →
 * CFCore.zoneStatuses → CFCore.statusOf.
 * ========================================================================= */
import { CFCore, CFLogic } from '../lib/shared';
import { currentRecords, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';

interface Props {
  history: History;
  filters: Filters;
  onPickColor: (color: string) => void;
}

function devClass(d: number | null) {
  if (d === null || d === undefined || isNaN(d)) return '';
  return d >= 0 ? 'pos' : 'neg';
}

export default function ProblemZones({ history, filters: S, onPickColor }: Props) {
  let recs = currentRecords(history, S);
  if (S.orient !== 'Both') recs = recs.filter((r: any) => r.orient === S.orient);
  const pb = CFLogic.problemZones(recs, history.standards, 25);
  const has = pb.total > 0;

  return (
    <section className="card">
      <div className="chead">
        <h2>Problem checkzones — what to fix first</h2>
        <span className="spacer" />
        <span className="eyebrow">
          {has
            ? `${pb.total} checkzone${pb.total === 1 ? '' : 's'} below target${
                pb.total > pb.list.length ? ' · showing worst ' + pb.list.length : ''
              }`
            : ''}
        </span>
      </div>
      {!has ? (
        <div className="empty good">✓ Every checkzone meets the average target for this selection.</div>
      ) : (
        <div className="tscroll" style={{ maxHeight: 340 }}>
          <table className="zones">
            <thead>
              <tr>
                <th>Status</th>
                <th>Color</th>
                <th>Checkzone</th>
                <th>Position</th>
                <th>Model</th>
                <th>Plant</th>
                <th className="r">CF</th>
                <th className="r">Δ Ford</th>
                <th className="r">Δ Min</th>
              </tr>
            </thead>
            <tbody>
              {pb.list.map((z: any, i: number) => (
                <tr
                  key={i}
                  className="rowlink"
                  title={'Open ' + z.color + ' in Checkzone detail'}
                  onClick={() => onPickColor(z.color)}
                >
                  <td>
                    <span className={'pill ' + z.status}>{z.status}</span>
                  </td>
                  <td>
                    <b>{z.color}</b>
                  </td>
                  <td className="num">{z.zone}</td>
                  <td>{z.orient === 'H' ? 'Horizontal' : 'Vertical'}</td>
                  <td>{CFCore.modelLabel(z.model)}</td>
                  <td>{z.plant || '—'}</td>
                  <td className="r num">{CFCore.fmtCF(z.cf)}</td>
                  <td className={'r num dev ' + devClass(z.devFord)}>{CFLogic.fmtDelta(z.devFord)}</td>
                  <td className={'r num dev ' + devClass(z.devMin)}>{CFLogic.fmtDelta(z.devMin)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="hint" style={{ padding: '0 18px 12px' }}>
        Sorted worst first (FAIL by deepest gap below the minimum, then WARNING). Click a row to open that color in
        Checkzone detail.
      </div>
    </section>
  );
}
