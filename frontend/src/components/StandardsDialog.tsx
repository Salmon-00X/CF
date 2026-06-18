/* =========================================================================
 * StandardsDialog — two tabs: Color Families (editable table) and Per-Color
 * Overrides. Port of openStandards()/saveStandards()/resetStandards()/
 * applyColorOverride()/clearColorOverride(). FTM badge marks IMG-reference FTM
 * colors. Save → PUT /api/standards. Logic unchanged; presentation is a shadcn
 * Dialog (the legacy Seg tab control is replaced by an inline toggle).
 * ========================================================================= */
import { useEffect, useMemo, useState } from 'react';
import { CFCore, CFLogic } from '../lib/shared';
import type { Standards, StandardRow } from '../lib/api';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { X } from 'lucide-react';

interface Props {
  standards: Standards;
  historyColors: string[];
  onSave: (s: Standards) => void;
  onClose: () => void;
}

const KEYS: Array<keyof StandardRow> = ['fordH', 'fordV', 'minH', 'minV'];

function titleCaseColor(s: string) {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bIi\b/g, 'II');
}

export default function StandardsDialog({ standards, historyColors, onSave, onClose }: Props) {
  const [tab, setTab] = useState<'family' | 'color'>('family');
  const [families, setFamilies] = useState<Record<string, StandardRow>>(() =>
    JSON.parse(JSON.stringify(standards.families))
  );
  const [colors, setColors] = useState<Record<string, StandardRow>>(() =>
    JSON.parse(JSON.stringify(standards.colors || {}))
  );

  // Known colors: the PDF reference list + anything seen in history.
  const known = useMemo(() => {
    const seen: Record<string, { name: string; family: string; ftm: boolean }> = {};
    Object.keys(CFCore.COLOR_FAMILY).forEach((k) => {
      seen[k] = { name: titleCaseColor(k), family: CFCore.COLOR_FAMILY[k], ftm: !!CFCore.FTM_COLORS[k] };
    });
    historyColors.forEach((name) => {
      const lk = name.toLowerCase();
      if (!seen[lk]) {
        const fam = (CFCore.normalizeColor(name) || {}).family || CFCore.COLOR_FAMILY[lk] || '';
        seen[lk] = { name, family: fam, ftm: !!CFCore.FTM_COLORS[lk] };
      }
    });
    return Object.values(seen).sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));
  }, [historyColors]);

  const [selColor, setSelColor] = useState<string>(() => (known[0] ? known[0].name : ''));

  const selFamily =
    (CFCore.normalizeColor(selColor) || {}).family || CFCore.COLOR_FAMILY[selColor.toLowerCase()] || '';
  const selIsFtm = !!CFCore.FTM_COLORS[selColor.toLowerCase()];
  const famDefault: StandardRow =
    families[selFamily] || CFCore.DEFAULT_STANDARDS[selFamily] || { fordH: 0, fordV: 0, minH: 0, minV: 0 };
  const [editor, setEditor] = useState<StandardRow>(famDefault);

  // Reload the per-color editor when the selected color changes.
  useEffect(() => {
    setEditor(colors[selColor] || famDefault);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selColor]);

  function setFamCell(fam: string, k: keyof StandardRow, v: number) {
    setFamilies((prev) => ({ ...prev, [fam]: { ...prev[fam], [k]: v } }));
  }

  function valid(row: StandardRow) {
    return KEYS.every((k) => isFinite(row[k]) && row[k] > 0 && row[k] <= 200);
  }

  function applyOverride() {
    if (!selColor) return;
    if (!valid(editor)) {
      alert('Targets must be numbers between 0 and 200.');
      return;
    }
    if (editor.fordH <= editor.minH || editor.fordV <= editor.minV) {
      if (!window.confirm('Ford target is not above the Minimum for ' + selColor + '. Save anyway?')) return;
    }
    setColors((prev) => ({ ...prev, [selColor]: { ...editor } }));
  }

  function removeOverride(name: string) {
    setColors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function save() {
    for (const fam of Object.keys(families)) {
      if (!valid(families[fam])) {
        alert('Check the value for ' + fam + ' — each must be a number between 0 and 200.');
        setTab('family');
        return;
      }
    }
    const bad = Object.keys(families).filter(
      (f) => families[f].fordH <= families[f].minH || families[f].fordV <= families[f].minV
    );
    if (bad.length && !window.confirm('For ' + bad.join(', ') + ' the Ford target is not above the Minimum. Save anyway?'))
      return;
    onSave({ families, colors });
  }

  function reset() {
    const d = CFLogic.defaultStandards();
    setFamilies(JSON.parse(JSON.stringify(d.families)));
    setColors({});
  }

  const overrideNames = Object.keys(colors).sort();
  const numCell = 'h-8 w-20 text-right tabular-nums';

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-h-[88vh] gap-4 overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <DialogTitle>Wavescan standards</DialogTitle>
          <div className="flex rounded-md border bg-background p-0.5">
            {(['family', 'color'] as const).map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={tab === t}
                onClick={() => setTab(t)}
                className={cn(
                  'rounded px-2.5 py-1 text-xs font-medium transition-colors',
                  tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
                )}
              >
                {t === 'family' ? 'Families' : 'Per-color overrides'}
              </button>
            ))}
          </div>
        </DialogHeader>

        {tab === 'family' ? (
          <div>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-1 text-left font-medium">Color family</th>
                  <th className="py-1 text-right font-medium">Ford H</th>
                  <th className="py-1 text-right font-medium">Ford V</th>
                  <th className="py-1 text-right font-medium">Min H</th>
                  <th className="py-1 text-right font-medium">Min V</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(families).map((fam) => (
                  <tr key={fam} className="border-b last:border-0">
                    <td className="py-1 pr-2">{fam}</td>
                    {KEYS.map((k) => (
                      <td className="py-1 text-right" key={k}>
                        <Input
                          type="number"
                          step="0.1"
                          className={cn(numCell, 'ml-auto')}
                          value={families[fam][k]}
                          aria-label={fam + ' ' + k}
                          onChange={(e) => setFamCell(fam, k, Number(e.target.value))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-xs text-muted-foreground">
              Pass when <b className="text-foreground">avg ≥ Min + 2</b>. Warning when avg is in{' '}
              <b className="text-foreground">[Min, Min + 2)</b> — getting close to the floor. Fail when avg is below
              Min. The Ford target stays as the dashed reference line on charts but no longer changes the status.
              Ranger (shown as <b className="text-foreground">DBL</b>) and Raptor share these.
            </p>
          </div>
        ) : (
          <div>
            <div className="mb-3 flex flex-wrap gap-3">
              <label className="flex-1 space-y-1 text-xs font-medium text-muted-foreground">
                Color
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={selColor}
                  onChange={(e) => setSelColor(e.target.value)}
                >
                  {known.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name + (c.ftm ? '  ✓ FTM' : '')}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-xs font-medium text-muted-foreground">
                Family
                <Input readOnly value={selFamily || '—'} className="h-9 w-40 bg-muted" />
              </label>
            </div>

            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-1 text-left font-medium">Targets for this color only</th>
                  <th className="py-1 text-right font-medium">Ford H</th>
                  <th className="py-1 text-right font-medium">Ford V</th>
                  <th className="py-1 text-right font-medium">Min H</th>
                  <th className="py-1 text-right font-medium">Min V</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td className="py-1 pr-2">
                    <b>{selColor || '—'}</b>
                    {selIsFtm && (
                      <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                        FTM
                      </span>
                    )}
                  </td>
                  {KEYS.map((k) => (
                    <td className="py-1 text-right" key={k}>
                      <Input
                        type="number"
                        step="0.1"
                        className={cn(numCell, 'ml-auto')}
                        value={editor[k]}
                        onChange={(e) => setEditor((prev) => ({ ...prev, [k]: Number(e.target.value) }))}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>

            <div className="mt-3 flex gap-2">
              <Button size="sm" onClick={applyOverride}>Apply override</Button>
              <Button size="sm" variant="outline" onClick={() => removeOverride(selColor)}>
                Remove override
              </Button>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              A per-color override is used in place of the family default for every reading of this color — useful for
              variant chemistries. The badge marks colors actively run at FTM per the IMG reference.
            </p>

            <h3 className="mb-1.5 mt-5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
              Current overrides
            </h3>
            {overrideNames.length ? (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs text-muted-foreground">
                    <th className="py-1 text-left font-medium">Color</th>
                    <th className="py-1 text-right font-medium">Ford H</th>
                    <th className="py-1 text-right font-medium">Ford V</th>
                    <th className="py-1 text-right font-medium">Min H</th>
                    <th className="py-1 text-right font-medium">Min V</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {overrideNames.map((n) => (
                    <tr key={n} className="border-b last:border-0">
                      <td className="py-1 pr-2">{n}</td>
                      <td className="py-1 text-right tabular-nums">{colors[n].fordH}</td>
                      <td className="py-1 text-right tabular-nums">{colors[n].fordV}</td>
                      <td className="py-1 text-right tabular-nums">{colors[n].minH}</td>
                      <td className="py-1 text-right tabular-nums">{colors[n].minV}</td>
                      <td className="py-1 text-right">
                        <button
                          type="button"
                          title="Remove"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeOverride(n)}
                        >
                          <X className="size-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-xs text-muted-foreground">
                No overrides yet — every color uses its family default.
              </p>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={reset}>Reset to defaults</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Close</Button>
            <Button onClick={save}>Save standards</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
