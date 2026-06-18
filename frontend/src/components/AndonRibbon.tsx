/* =========================================================================
 * AndonRibbon — three KPI cards: PASS / WARNING / FAIL. Port of renderRibbon():
 * zone-off counts + month-over-month ▲/▼ flags (single month only). Status
 * comes from CFLogic.summarize → CFCore.statusOf. Logic is unchanged from the
 * legacy ribbon; only the presentation is shadcn Cards.
 * ========================================================================= */
import { CFCore, CFLogic } from '../lib/shared';
import { activeFilters, currentRecords, periodKeys, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface Props {
  history: History;
  filters: Filters;
}

function ribbonKey(g: any) {
  return [g.model || '?', g.color, g.orient].join('|');
}

type Status = 'PASS' | 'WARNING' | 'FAIL';

const STYLES: Record<Status, { label: string; ring: string; count: string; dot: string }> = {
  PASS: { label: 'Pass', ring: 'border-l-emerald-500', count: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  WARNING: { label: 'Warning', ring: 'border-l-amber-500', count: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  FAIL: { label: 'Fail', ring: 'border-l-destructive', count: 'text-destructive', dot: 'bg-destructive' },
};

export default function AndonRibbon({ history, filters: S }: Props) {
  const recs = currentRecords(history, S);
  const std = history.standards;
  const sum = CFLogic.summarize(recs, std);
  const counts = CFLogic.zoneCounts(recs, std);
  const mom =
    periodKeys(history, S).length === 1
      ? CFLogic.momDeltas(history, S.monthKey, activeFilters(S), std)
      : { prevKey: null, prevLabel: null, map: {} };

  const orientVisible = (g: any) => S.orient === 'Both' || g.orient === S.orient;
  const order: Status[] = ['PASS', 'WARNING', 'FAIL'];

  return (
    <section className="grid grid-cols-1 gap-3 md:grid-cols-3" aria-label="Status summary">
      {order.map((status) => {
        const st = STYLES[status];
        const groups = sum.byStatus[status].filter(orientVisible);
        return (
          <Card key={status} className={cn('border-l-4', st.ring)}>
            <CardHeader className="flex-row items-baseline gap-2 py-2">
              <span className={cn('font-mono text-3xl font-bold tabular-nums', st.count)}>{groups.length}</span>
              <span className="text-sm font-medium text-muted-foreground">{st.label}</span>
            </CardHeader>
            <CardContent className="space-y-1.5 pt-0 text-sm">
              {status === 'PASS' ? (
                <p className="text-muted-foreground">
                  {groups.length
                    ? groups
                        .map((g: any) => {
                          const pv = mom.map[ribbonKey(g)];
                          const arrow = pv === undefined ? '' : g.avg - pv >= 0 ? ' ▲' : ' ▼';
                          return g.color + ' ' + g.orient + arrow;
                        })
                        .join(' · ')
                    : 'Nothing passing yet.'}
                </p>
              ) : !groups.length ? (
                <p className="text-muted-foreground">
                  {status === 'FAIL'
                    ? 'No color is below the minimum.'
                    : 'No color is in the warning band.'}
                </p>
              ) : (
                groups.map((g: any) => {
                  const zc = counts[ribbonKey(g)];
                  const pv = mom.map[ribbonKey(g)];
                  const d = pv !== undefined ? g.avg - pv : null;
                  const up = d !== null && d >= 0;
                  return (
                    <div key={ribbonKey(g)} className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <b className="font-semibold">{g.color}</b>
                      <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {CFCore.modelLabel(g.model)} · {g.orient === 'H' ? 'Hor' : 'Ver'}
                      </span>
                      {zc && zc.fail + zc.warn > 0 && (
                        <span
                          className="text-[11px] tabular-nums text-muted-foreground"
                          title={`${zc.fail} failing, ${zc.warn} in warning, of ${zc.total} checkzones`}
                        >
                          {zc.fail + zc.warn}/{zc.total} zones off
                        </span>
                      )}
                      {d !== null && (
                        <span
                          className={cn(
                            'text-[11px] font-medium tabular-nums',
                            up ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'
                          )}
                          title={`Average vs ${mom.prevLabel} (${CFLogic.fmtDelta(d)})`}
                        >
                          {(up ? '▲' : '▼') + Math.abs(Math.round(d * 10) / 10).toFixed(1)}
                        </span>
                      )}
                      <span className="w-full font-mono text-[11px] tabular-nums text-muted-foreground">
                        avg {CFCore.fmtCF(g.avg)} / Ford {g.ford} · Min {g.minStd}
                      </span>
                    </div>
                  );
                })
              )}
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
