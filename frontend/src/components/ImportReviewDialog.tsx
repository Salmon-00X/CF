/* =========================================================================
 * ImportReviewDialog (<dialog id="dlgReview">) — confirm a staged import.
 * Port of openReview() / commitImport() / cancelImport(). Month auto-detected
 * from the filename; Year/Model/Plant adjustable. Confirm → commit, Cancel →
 * discard the staged import.
 * ========================================================================= */
import { useEffect, useRef, useState } from 'react';
import { CFCore } from '../lib/shared';
import type { ImportStaged } from '../lib/api';

interface Props {
  staged: ImportStaged;
  fileName: string;
  onCommit: (body: { monthKey: string; model: string; plant: string | null }) => void;
  onCancel: () => void;
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function ImportReviewDialog({ staged, fileName, onCommit, onCancel }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const now = new Date();
  const hint = staged.monthHint;

  const [month, setMonth] = useState<number>(hint ? hint.month : now.getMonth() + 1);
  const [year, setYear] = useState<number>(hint ? hint.year : now.getFullYear());

  const det = staged.modelDetected;
  const [model, setModel] = useState<string>(det && det !== 'Mixed' ? 'auto' : det === 'Mixed' ? 'auto' : 'Ranger');
  const [plant, setPlant] = useState<string>(staged.plantDetected || '');

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  const y0 = now.getFullYear();
  const yDet = hint ? hint.year : null;
  const yLo = Math.min(y0 - 6, yDet === null ? y0 : yDet);
  const yHi = Math.max(y0 + 1, yDet === null ? y0 : yDet);
  const years: number[] = [];
  for (let y = yLo; y <= yHi; y++) years.push(y);

  const modelOpts: Array<{ v: string; label: string }> = [];
  if (det && det !== 'Mixed') modelOpts.push({ v: 'auto', label: 'Auto: ' + CFCore.modelLabel(det) + ' (detected)' });
  else if (det === 'Mixed') modelOpts.push({ v: 'auto', label: 'Auto: per row (DBL + Raptor found)' });
  modelOpts.push({ v: 'Ranger', label: 'DBL (Ranger) — apply to all rows' });
  modelOpts.push({ v: 'Raptor', label: 'Raptor — apply to all rows' });

  function commit() {
    if (!(month >= 1 && month <= 12) || !(year >= 2000 && year <= 2100)) return;
    onCommit({ monthKey: CFCore.monthKey(year, month), model, plant: plant || null });
  }

  return (
    <dialog ref={ref} aria-labelledby="rvTitle" onCancel={(e) => { e.preventDefault(); onCancel(); }}>
      <div className="dlg-head">
        <h2 id="rvTitle">
          Review import — <span className="num">{fileName}</span>
        </h2>
      </div>
      <div className="dlg-body">
        <div className="frow">
          <label>
            Month
            <select value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((n, i) => (
                <option key={i} value={i + 1}>
                  {n}
                </option>
              ))}
            </select>
          </label>
          <label>
            Year
            <select value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <label>
            Model
            <select value={model} onChange={(e) => setModel(e.target.value)}>
              {modelOpts.map((o) => (
                <option key={o.v} value={o.v}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Plant
            <select value={plant} onChange={(e) => setPlant(e.target.value)}>
              <option value="">{staged.plantDetected ? 'Auto: ' + staged.plantDetected : 'Auto / none'}</option>
              {CFCore.PLANTS.map((p: string) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="note">{hint ? 'Month detected from the file name.' : 'The file name has no month — set it here.'}</div>
        <div className="note">
          <b>{staged.rowCount}</b> reading{staged.rowCount === 1 ? '' : 's'} recognised.
        </div>
        {staged.warnings.length > 0 && (
          <div id="rvWarnWrap">
            <div className="note" style={{ color: '#7c4a06', fontWeight: 600, marginTop: 12 }}>
              Check before adding ({staged.warnings.length}):
            </div>
            <ul className="note" style={{ marginTop: 4 }}>
              {staged.warnings.slice(0, 12).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {staged.warnings.length > 12 && <li>… and {staged.warnings.length - 12} more.</li>}
            </ul>
          </div>
        )}
      </div>
      <div className="dlg-foot">
        <button className="btn" type="button" onClick={onCancel}>
          Cancel
        </button>
        <button className="btn primary" type="button" onClick={commit}>
          Add to history
        </button>
      </div>
    </dialog>
  );
}
