/* =========================================================================
 * ImportReviewDialog — confirm a staged import. Port of openReview() /
 * commitImport() / cancelImport(). Month auto-detected from the filename;
 * Year/Model/Plant adjustable. Confirm → commit, Cancel → discard the staged
 * import. Logic unchanged; presentation is a shadcn Dialog.
 * ========================================================================= */
import { useState } from 'react';
import { CFCore } from '../lib/shared';
import type { ImportStaged } from '../lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

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

const fieldCls =
  'h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

export default function ImportReviewDialog({ staged, fileName, onCommit, onCancel }: Props) {
  const now = new Date();
  const hint = staged.monthHint;

  const [month, setMonth] = useState<number>(hint ? hint.month : now.getMonth() + 1);
  const [year, setYear] = useState<number>(hint ? hint.year : now.getFullYear());

  const det = staged.modelDetected;
  const [model, setModel] = useState<string>(det && det !== 'Mixed' ? 'auto' : det === 'Mixed' ? 'auto' : 'Ranger');
  const [plant, setPlant] = useState<string>(staged.plantDetected || '');

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
    <Dialog open onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            Review import — <span className="font-mono text-sm font-normal">{fileName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Month
            <select className={fieldCls} value={month} onChange={(e) => setMonth(Number(e.target.value))}>
              {MONTHS.map((n, i) => (
                <option key={i} value={i + 1}>{n}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Year
            <select className={fieldCls} value={year} onChange={(e) => setYear(Number(e.target.value))}>
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Model
            <select className={fieldCls} value={model} onChange={(e) => setModel(e.target.value)}>
              {modelOpts.map((o) => (
                <option key={o.v} value={o.v}>{o.label}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1 text-xs font-medium text-muted-foreground">
            Plant
            <select className={fieldCls} value={plant} onChange={(e) => setPlant(e.target.value)}>
              <option value="">{staged.plantDetected ? 'Auto: ' + staged.plantDetected : 'Auto / none'}</option>
              {CFCore.PLANTS.map((p: string) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p>{hint ? 'Month detected from the file name.' : 'The file name has no month — set it here.'}</p>
          <p>
            <b className="text-foreground">{staged.rowCount}</b> reading
            {staged.rowCount === 1 ? '' : 's'} recognised.
          </p>
        </div>

        {staged.warnings.length > 0 && (
          <div className="rounded-md bg-amber-500/10 p-3 text-sm">
            <div className="font-semibold text-amber-700 dark:text-amber-400">
              Check before adding ({staged.warnings.length}):
            </div>
            <ul className="mt-1 list-disc pl-5 text-muted-foreground">
              {staged.warnings.slice(0, 12).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
              {staged.warnings.length > 12 && <li>… and {staged.warnings.length - 12} more.</li>}
            </ul>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>Cancel</Button>
          <Button onClick={commit}>Add to history</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
