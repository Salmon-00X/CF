/* =========================================================================
 * ReadingsGrid — all readings for the month, edited spreadsheet-style.
 * Editable: color (Select → family recomputes server-side), zone (text),
 * position (H/V), model (DBL/Raptor), plant (Select), cf (number).
 * Click a cell to edit; Enter/blur commits (PATCH); Esc cancels. Each commit
 * reloads the app so the dashboard reflects the edit.
 * ========================================================================= */
import { useEffect, useMemo, useState } from 'react';
import { api, type Reading } from '../../lib/api';
import { CFCore, CFLogic } from '../../lib/shared';
import type { History } from '../../lib/select';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

const PLANT_NONE = '__none__';
const fieldCls =
  'h-8 w-full rounded border border-input bg-background px-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

interface Props {
  history: History;
  monthKey: string;
  reload: () => Promise<unknown>;
}

type Field = 'color' | 'zone' | 'orient' | 'model' | 'plant' | 'cf';

export default function ReadingsGrid({ monthKey, reload }: Props) {
  const [rows, setRows] = useState<Reading[]>([]);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<{ id: number; field: Field } | null>(null);

  useEffect(() => {
    api
      .readings(monthKey)
      .then(setRows)
      .catch((e) => toast.error('Could not load readings: ' + e.message));
  }, [monthKey]);

  const knownColors = useMemo(() => {
    const set = new Set<string>();
    Object.keys(CFCore.COLOR_FAMILY || {}).forEach((k) =>
      set.add(k.replace(/\b[a-z]/g, (c) => c.toUpperCase()))
    );
    rows.forEach((r) => set.add(r.color));
    return Array.from(set).sort();
  }, [rows]);
  const plants: string[] = CFCore.PLANTS || [];

  const shown = rows.filter((r) => {
    const q = filter.trim().toLowerCase();
    return !q || r.color.toLowerCase().includes(q) || r.zone.toLowerCase().includes(q);
  });

  async function commit(id: number, patch: Partial<Reading>) {
    try {
      const updated = await api.updateReading(id, patch as any);
      setRows((rs) => rs.map((r) => (r.id === id ? updated : r)));
      setEditing(null);
      toast.success('Reading updated.');
      reload();
    } catch (e: any) {
      toast.error('Edit rejected: ' + e.message); // cell stays in edit
    }
  }

  async function del(r: Reading) {
    try {
      await api.deleteReading(r.id!);
      setRows((rs) => rs.filter((x) => x.id !== r.id));
      toast.success('Reading deleted.');
      reload();
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message);
    }
  }

  function isEditing(id: number, field: Field) {
    return editing?.id === id && editing.field === field;
  }

  /** A display cell that turns into the right editor on click. */
  function Cell({ r, field }: { r: Reading; field: Field }) {
    if (!isEditing(r.id!, field)) {
      const display =
        field === 'orient'
          ? r.orient === 'H'
            ? 'Horizontal'
            : 'Vertical'
          : field === 'model'
          ? r.model
            ? CFCore.modelLabel(r.model)
            : '—'
          : field === 'plant'
          ? r.plant || '—'
          : field === 'cf'
          ? CFCore.fmtCF(r.cf)
          : (r as any)[field];
      return (
        <button
          type="button"
          className="block w-full cursor-pointer rounded px-1 py-0.5 text-left hover:bg-muted"
          onClick={() => setEditing({ id: r.id!, field })}
        >
          {display}
        </button>
      );
    }

    const cancel = () => setEditing(null);

    if (field === 'cf' || field === 'zone') {
      return (
        <Input
          autoFocus
          defaultValue={field === 'cf' ? String(r.cf) : r.zone}
          type={field === 'cf' ? 'number' : 'text'}
          step={field === 'cf' ? '0.1' : undefined}
          className="h-8"
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') cancel();
          }}
          onBlur={(e) => {
            const v = e.target.value;
            if (field === 'cf') {
              const n = Number(v);
              if (!isFinite(n) || n <= 0 || n > 200) {
                toast.error('CF must be 0–200.');
                cancel();
                return;
              }
              if (n === r.cf) return cancel();
              commit(r.id!, { cf: n });
            } else {
              const z = v.trim();
              if (!z) {
                toast.error('Checkzone cannot be empty.');
                cancel();
                return;
              }
              if (z === r.zone) return cancel();
              commit(r.id!, { zone: z });
            }
          }}
        />
      );
    }
    if (field === 'orient') {
      return (
        <select
          autoFocus
          className={fieldCls}
          defaultValue={r.orient}
          onBlur={cancel}
          onChange={(e) => e.target.value !== r.orient && commit(r.id!, { orient: e.target.value as 'H' | 'V' })}
        >
          <option value="H">Horizontal</option>
          <option value="V">Vertical</option>
        </select>
      );
    }
    if (field === 'model') {
      return (
        <select
          autoFocus
          className={fieldCls}
          defaultValue={r.model ?? ''}
          onBlur={cancel}
          onChange={(e) => commit(r.id!, { model: (e.target.value || null) as any })}
        >
          <option value="Ranger">DBL (Ranger)</option>
          <option value="Raptor">Raptor</option>
        </select>
      );
    }
    if (field === 'plant') {
      return (
        <select
          autoFocus
          className={fieldCls}
          defaultValue={r.plant ?? PLANT_NONE}
          onBlur={cancel}
          onChange={(e) =>
            commit(r.id!, { plant: (e.target.value === PLANT_NONE ? null : e.target.value) as any })
          }
        >
          <option value={PLANT_NONE}>— none —</option>
          {plants.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      );
    }
    // color
    return (
      <select
        autoFocus
        className={fieldCls}
        defaultValue={r.color}
        onBlur={cancel}
        onChange={(e) => e.target.value !== r.color && commit(r.id!, { color: e.target.value })}
      >
        {knownColors.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Readings — {CFLogic.keyToLabel(monthKey)}</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{shown.length} rows</span>
          <Input
            placeholder="Filter color / zone…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 w-44"
          />
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No readings for this month.</p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Color</TableHead>
                  <TableHead>Family</TableHead>
                  <TableHead>Checkzone</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Plant</TableHead>
                  <TableHead className="text-right">CF</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="p-1">
                      <Cell r={r} field="color" />
                    </TableCell>
                    <TableCell className="text-muted-foreground">{r.family || '—'}</TableCell>
                    <TableCell className="p-1">
                      <Cell r={r} field="zone" />
                    </TableCell>
                    <TableCell className="p-1">
                      <Cell r={r} field="orient" />
                    </TableCell>
                    <TableCell className="p-1">
                      <Cell r={r} field="model" />
                    </TableCell>
                    <TableCell className="p-1">
                      <Cell r={r} field="plant" />
                    </TableCell>
                    <TableCell className="p-1 text-right tabular-nums">
                      <Cell r={r} field="cf" />
                    </TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this reading?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {r.color} · {r.zone} · {r.orient} · CF {CFCore.fmtCF(r.cf)} will be removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => del(r)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
