/* =========================================================================
 * ChartCards — Horizontal (left) + Vertical (right). Port of renderCharts() +
 * buildChart(). The sidebar Chart-type seg (S.chartType) controls both; the
 * Position filter hides one side. All traces/means come from the shared plot
 * builders. PlotlyChart itself is unchanged — we only wrap it in a shadcn Card
 * and give its container an explicit height (the old .plot CSS is gone).
 * ========================================================================= */
import { CFLogic } from '../lib/shared';
import { currentRecords, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';
import PlotlyChart from './PlotlyChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Props {
  history: History;
  filters: Filters;
}

const CHART_TITLE: Record<string, string> = {
  box: 'Boxplot of CF — ',
  pareto: 'Pareto of CF — ',
  interval: 'Ranking of mean CF — ',
};

const EMPTY = (what: string) =>
  `<div style="padding:2.5rem;text-align:center;color:hsl(var(--muted-foreground));font-size:0.875rem">No ${what} readings for this selection.</div>`;

function buildChart(recs: any[], std: any, chartType: string, orient: string) {
  if (chartType === 'pareto') return CFLogic.buildParetoPlot(recs, std, orient);
  if (chartType === 'interval') return CFLogic.buildIntervalPlot(recs, std, orient);
  return CFLogic.buildOrientPlot(recs, std, orient, {});
}

export default function ChartCards({ history, filters: S }: Props) {
  const recs = currentRecords(history, S);
  const defs: Array<['H' | 'V', string]> = [
    ['H', 'Horizontal'],
    ['V', 'Vertical'],
  ];

  return (
    <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
      {defs.map(([orient, word]) => {
        const visible = S.orient === 'Both' || S.orient === orient;
        if (!visible) return null;
        const p = buildChart(recs, history.standards, S.chartType, orient);
        const what = orient === 'H' ? 'horizontal (hood / roof)' : 'vertical';
        return (
          <Card key={orient}>
            <CardHeader className="flex-row items-center justify-between gap-3 pb-2">
              <CardTitle className="text-base">
                {(CHART_TITLE[S.chartType] || CHART_TITLE.box) + word}
              </CardTitle>
              <div className="flex shrink-0 items-center gap-3 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-0 w-3 border-t-2 border-dashed border-[#102a6b] dark:border-sky-400" />
                  Average Target
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-0 w-3 border-t-2 border-dashed border-destructive" />
                  Min. Requirement
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <PlotlyChart
                className="h-[360px] w-full"
                plot={p}
                orient={orient}
                emptyHtml={EMPTY(what)}
              />
            </CardContent>
          </Card>
        );
      })}
    </section>
  );
}
