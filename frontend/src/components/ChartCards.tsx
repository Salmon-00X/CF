/* =========================================================================
 * ChartCards (.charts2) — Horizontal (left) + Vertical (right). Port of
 * renderCharts() + buildChart(). The sidebar Chart-type seg (S.chartType)
 * controls both; Position filter hides one side. All traces/means come from the
 * shared plot builders.
 * ========================================================================= */
import { CFLogic } from '../lib/shared';
import { currentRecords, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';
import PlotlyChart from './PlotlyChart';

interface Props {
  history: History;
  filters: Filters;
}

const CHART_TITLE: Record<string, string> = {
  box: 'Boxplot of CF — ',
  pareto: 'Pareto of CF — ',
  interval: 'Ranking of mean CF — ',
};

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
    <section className="charts2">
      {defs.map(([orient, word]) => {
        const visible = S.orient === 'Both' || S.orient === orient;
        if (!visible) return null;
        const p = buildChart(recs, history.standards, S.chartType, orient);
        const what = orient === 'H' ? 'horizontal (hood / roof)' : 'vertical';
        return (
          <div className="card" key={orient}>
            <div className="chead">
              <h2>{(CHART_TITLE[S.chartType] || CHART_TITLE.box) + word}</h2>
              <span className="spacer" />
              <span className="legend-key">
                <span className="k-ford">
                  <i />
                  Average Target
                </span>
                <span className="k-min">
                  <i />
                  Min. Requirement
                </span>
              </span>
            </div>
            <PlotlyChart
              plot={p}
              orient={orient}
              emptyHtml={`<div class="empty">No ${what} readings for this selection.</div>`}
            />
          </div>
        );
      })}
    </section>
  );
}
