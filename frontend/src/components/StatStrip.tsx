/* StatStrip — hero metric tiles: PASS / WARNING / FAIL + total readings.
   Counts use the same CFLogic.summarize + orient filter as the old AndonRibbon. */
import { CFLogic } from '../lib/shared';
import { currentRecords, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle, Database } from 'lucide-react';

interface Props {
  history: History;
  filters: Filters;
}
type Status = 'PASS' | 'WARNING' | 'FAIL';

export default function StatStrip({ history, filters: S }: Props) {
  let recs = currentRecords(history, S);
  if (S.orient !== 'Both') recs = recs.filter((r: any) => r.orient === S.orient);
  const sum = CFLogic.summarize(recs, history.standards);
  const visible = (g: any) => S.orient === 'Both' || g.orient === S.orient;
  const count = (st: Status) => sum.byStatus[st].filter(visible).length;

  const tiles = [
    { label: 'Pass', value: count('PASS'), Icon: CheckCircle2, border: 'border-l-emerald-500', val: 'text-emerald-600 dark:text-emerald-400' },
    { label: 'Warning', value: count('WARNING'), Icon: AlertTriangle, border: 'border-l-amber-500', val: 'text-amber-600 dark:text-amber-400' },
    { label: 'Fail', value: count('FAIL'), Icon: XCircle, border: 'border-l-destructive', val: 'text-destructive' },
    { label: 'Readings', value: recs.length, Icon: Database, border: 'border-l-primary', val: 'text-primary dark:text-sky-300' },
  ];

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Status summary">
      {tiles.map((t) => (
        <Card key={t.label} className={cn('border-l-4 p-4', t.border)}>
          <div className="flex items-center justify-between">
            <div>
              <div className={cn('font-mono text-4xl font-bold tabular-nums', t.val)}>{t.value}</div>
              <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.label}</div>
            </div>
            <t.Icon className={cn('size-8 opacity-25', t.val)} aria-hidden="true" />
          </div>
        </Card>
      ))}
    </section>
  );
}
