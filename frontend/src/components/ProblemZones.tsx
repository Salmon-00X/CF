/* =========================================================================
 * ProblemZones — worst-offender digest. Port of renderProblems(): FAIL-first,
 * then WARNING, by deepest deficit below the minimum. Status from
 * CFLogic.problemZones → CFCore.zoneStatuses → CFCore.statusOf. Logic
 * unchanged; presentation is a shadcn Table inside a Card.
 * ========================================================================= */
import { CFCore, CFLogic } from '../lib/shared';
import { currentRecords, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';

interface Props {
  history: History;
  filters: Filters;
}

function devClass(d: number | null) {
  if (d === null || d === undefined || isNaN(d)) return 'text-muted-foreground';
  return d >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive';
}

const PILL: Record<string, string> = {
  FAIL: 'bg-destructive/10 text-destructive',
  WARNING: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  PASS: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
};

export default function ProblemZones({ history, filters: S }: Props) {
  let recs = currentRecords(history, S);
  if (S.orient !== 'Both') recs = recs.filter((r: any) => r.orient === S.orient);
  const pb = CFLogic.problemZones(recs, history.standards, 25);
  const has = pb.total > 0;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2">
        <CardTitle className="text-base">Problem checkzones — what to fix first</CardTitle>
        {has && (
          <span className="text-xs text-muted-foreground">
            {pb.total} checkzone{pb.total === 1 ? '' : 's'} below target
            {pb.total > pb.list.length ? ` · showing worst ${pb.list.length}` : ''}
          </span>
        )}
      </CardHeader>
      <CardContent>
        {!has ? (
          <div className="rounded-md bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            ✓ Every checkzone meets the average target for this selection.
          </div>
        ) : (
          <div className="max-h-[340px] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Status</TableHead>
                  <TableHead>Color</TableHead>
                  <TableHead>Checkzone</TableHead>
                  <TableHead>Position</TableHead>
                  <TableHead>Model</TableHead>
                  <TableHead>Plant</TableHead>
                  <TableHead className="text-right">CF</TableHead>
                  <TableHead className="text-right">Δ Ford</TableHead>
                  <TableHead className="text-right">Δ Min</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pb.list.map((z: any, i: number) => (
                  <TableRow key={i}>
                    <TableCell>
                      <span className={cn('rounded px-1.5 py-0.5 text-[11px] font-medium', PILL[z.status])}>
                        {z.status}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold">{z.color}</TableCell>
                    <TableCell className="tabular-nums">{z.zone}</TableCell>
                    <TableCell>{z.orient === 'H' ? 'Horizontal' : 'Vertical'}</TableCell>
                    <TableCell>{CFCore.modelLabel(z.model)}</TableCell>
                    <TableCell>{z.plant || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{CFCore.fmtCF(z.cf)}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', devClass(z.devFord))}>
                      {CFLogic.fmtDelta(z.devFord)}
                    </TableCell>
                    <TableCell className={cn('text-right tabular-nums', devClass(z.devMin))}>
                      {CFLogic.fmtDelta(z.devMin)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
        <p className="pt-3 text-xs text-muted-foreground">
          Sorted worst first (FAIL by deepest gap below the minimum, then WARNING).
        </p>
      </CardContent>
    </Card>
  );
}
