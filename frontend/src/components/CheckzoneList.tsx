/* CheckzoneList — checkzone detail rows. Default (no statusFilter) = worst-first
   problem zones (today's Action items). With a statusFilter = every checkzone of
   that status (CFCore.zoneStatuses). Row click → edit that color in the Data view. */
import { CFCore, CFLogic } from '../lib/shared';
import { currentRecords, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Status = 'PASS' | 'WARNING' | 'FAIL';

interface Props {
  history: History;
  filters: Filters;
  statusFilter?: Status | null;
  onPick?: (color: string) => void;
}

const DOT: Record<string, string> = { FAIL: 'bg-destructive', WARNING: 'bg-amber-500', PASS: 'bg-emerald-500' };
const CAP = 50;

export default function CheckzoneList({ history, filters: S, statusFilter, onPick }: Props) {
  let recs = currentRecords(history, S);
  if (S.orient !== 'Both') recs = recs.filter((r: any) => r.orient === S.orient);

  let rows: any[];
  let total: number;
  let title: string;
  if (statusFilter) {
    rows = CFCore.zoneStatuses(recs, history.standards).filter((z: any) => z.status === statusFilter);
    rows.sort((a: any, b: any) =>
      statusFilter === 'PASS'
        ? a.color.localeCompare(b.color) || a.zone.localeCompare(b.zone)
        : a.devMin - b.devMin
    );
    total = rows.length;
    title = `${statusFilter[0]}${statusFilter.slice(1).toLowerCase()} checkzones (${total})`;
  } else {
    const pb = CFLogic.problemZones(recs, history.standards, CAP);
    rows = pb.list;
    total = pb.total;
    title = 'Action items — fix first';
  }
  const shown = rows.slice(0, CAP);

  return (
    <Card className="flex flex-col">
      <CardHeader className="py-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="rounded-md bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            {statusFilter
              ? `No ${statusFilter.toLowerCase()} checkzones for this selection.`
              : '✓ Every checkzone meets the average target for this selection.'}
          </div>
        ) : (
          <ul className="space-y-1">
            {shown.map((z: any, i: number) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={onPick ? () => onPick(z.color) : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    onPick && 'cursor-pointer hover:bg-accent/15'
                  )}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', DOT[z.status] || 'bg-muted-foreground')} aria-hidden="true" />
                  <span className="font-medium">{z.color}</span>
                  <span className="text-xs text-muted-foreground">
                    {z.zone} · {z.orient}
                  </span>
                  <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                    {CFLogic.fmtDelta(z.devMin)}
                  </span>
                </button>
              </li>
            ))}
            {total > shown.length && (
              <li className="px-2 pt-1 text-xs text-muted-foreground">
                …and {total - shown.length} more — see the Data view.
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
