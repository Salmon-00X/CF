/* StatStrip — three clickable status tiles (Pass / Warning / Fail). Counts are
   zone-level (CFCore.zoneStatuses) so a tile's number equals what clicking it
   reveals. Clicking toggles the dashboard's status filter. */
import { CFCore } from '../lib/shared';
import { currentRecords, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

type Status = 'PASS' | 'WARNING' | 'FAIL';

interface Props {
  history: History;
  filters: Filters;
  active: Status | null;
  onSelect: (s: Status) => void;
}

const TILES: {
  status: Status;
  label: string;
  Icon: typeof CheckCircle2;
  border: string;
  val: string;
  ring: string;
  tint: string;
}[] = [
  { status: 'PASS', label: 'Pass', Icon: CheckCircle2, border: 'border-l-emerald-500', val: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500', tint: 'bg-emerald-500/10' },
  { status: 'WARNING', label: 'Warning', Icon: AlertTriangle, border: 'border-l-amber-500', val: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500', tint: 'bg-amber-500/10' },
  { status: 'FAIL', label: 'Fail', Icon: XCircle, border: 'border-l-destructive', val: 'text-destructive', ring: 'ring-destructive', tint: 'bg-destructive/10' },
];

export default function StatStrip({ history, filters: S, active, onSelect }: Props) {
  let recs = currentRecords(history, S);
  if (S.orient !== 'Both') recs = recs.filter((r: any) => r.orient === S.orient);
  const zones = CFCore.zoneStatuses(recs, history.standards);
  const count = (st: Status) => zones.filter((z: any) => z.status === st).length;

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Status summary (click to filter)">
      {TILES.map((t) => {
        const on = active === t.status;
        return (
          <button
            key={t.status}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(t.status)}
            className={cn(
              'rounded-xl border border-l-4 bg-card p-4 text-left text-card-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
              t.border,
              on ? cn('ring-2', t.ring, t.tint) : 'cursor-pointer hover:bg-muted/40'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className={cn('font-mono text-4xl font-bold tabular-nums', t.val)}>{count(t.status)}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.label}</div>
              </div>
              <t.Icon className={cn('size-8 opacity-25', t.val)} aria-hidden="true" />
            </div>
          </button>
        );
      })}
    </section>
  );
}
