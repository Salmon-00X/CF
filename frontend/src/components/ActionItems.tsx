/* ActionItems — ranked worst checkzones (problemZones), click → edit in Data view. */
import { CFLogic } from '../lib/shared';
import { currentRecords, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  history: History;
  filters: Filters;
  onPick?: (color: string) => void;
}

const DOT: Record<string, string> = { FAIL: 'bg-destructive', WARNING: 'bg-amber-500', PASS: 'bg-emerald-500' };

export default function ActionItems({ history, filters: S, onPick }: Props) {
  let recs = currentRecords(history, S);
  if (S.orient !== 'Both') recs = recs.filter((r: any) => r.orient === S.orient);
  const pb = CFLogic.problemZones(recs, history.standards, 12);

  return (
    <Card className="flex flex-col">
      <CardHeader className="py-3">
        <CardTitle className="text-base">Action items — fix first</CardTitle>
      </CardHeader>
      <CardContent>
        {pb.total === 0 ? (
          <div className="rounded-md bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            ✓ Every checkzone meets the average target for this selection.
          </div>
        ) : (
          <ul className="space-y-1">
            {pb.list.map((z: any, i: number) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={onPick ? () => onPick(z.color) : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    onPick && 'cursor-pointer hover:bg-accent/15'
                  )}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', DOT[z.status])} aria-hidden="true" />
                  <span className="font-medium">{z.color}</span>
                  <span className="text-xs text-muted-foreground">
                    {z.zone} · {z.orient}
                  </span>
                  <span className="ml-auto font-mono text-xs tabular-nums text-destructive">
                    {CFLogic.fmtDelta(z.devMin)}
                  </span>
                </button>
              </li>
            ))}
            {pb.total > pb.list.length && (
              <li className="px-2 pt-1 text-xs text-muted-foreground">
                …and {pb.total - pb.list.length} more — see the Data view.
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
