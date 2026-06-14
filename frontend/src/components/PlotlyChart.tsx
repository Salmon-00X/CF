/* =========================================================================
 * PlotlyChart — wraps plotly.js-dist-min (bundled, no CDN).
 *
 * CRITICAL (Doc/HANDOFF.md §8 + prototype plotInto()): never wipe innerHTML on
 * a live plot. Plotly.react diffs in place; clearing its DOM while
 * _fullLayout remains makes the next react() render blank. When the STRUCTURAL
 * signature changes (chart kind, orientation, the set of x-axis categories, or
 * trace count) we Plotly.purge() FIRST so stale axis categories/shapes/traces
 * cannot carry across — that leftover state was the "graph won't clear when I
 * change the month" bug. Regression-tested in the prototype.
 * ========================================================================= */
import { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

const PLOT_OPTS = {
  responsive: true,
  displaylogo: false,
  modeBarButtonsToRemove: ['lasso2d', 'select2d'],
};

export interface PlotSpec {
  kind?: string;
  colors?: string[];
  traces: any[];
  layout: any;
}

interface Props {
  plot: PlotSpec | null;
  orient?: string;
  emptyHtml?: string;
  className?: string;
  style?: React.CSSProperties;
}

export default function PlotlyChart({ plot, orient, emptyHtml, className, style }: Props) {
  const divRef = useRef<HTMLDivElement>(null);
  const sigRef = useRef<string>('');
  const emptyRef = useRef<boolean>(false);

  useEffect(() => {
    const div = divRef.current;
    if (!div) return;

    if (!plot) {
      if ((div as any)._fullLayout) {
        try {
          Plotly.purge(div);
        } catch {
          /* noop */
        }
      }
      div.innerHTML = emptyHtml || '';
      emptyRef.current = true;
      sigRef.current = '';
      return;
    }

    if (emptyRef.current) {
      div.innerHTML = '';
      emptyRef.current = false;
    }

    // Structural signature — chart kind | orientation | categories | trace count.
    const sig =
      `${plot.kind || ''}|${orient || ''}|` +
      `${(plot.colors || []).join('')}|${plot.traces.length}`;

    if ((div as any)._fullLayout && sigRef.current && sigRef.current !== sig) {
      try {
        Plotly.purge(div);
      } catch {
        /* noop */
      }
    }
    sigRef.current = sig;
    Plotly.react(div, plot.traces, plot.layout, PLOT_OPTS);
  }, [plot, orient, emptyHtml]);

  // Purge on unmount so Plotly releases its WebGL/DOM resources.
  useEffect(() => {
    return () => {
      const div = divRef.current;
      if (div && (div as any)._fullLayout) {
        try {
          Plotly.purge(div);
        } catch {
          /* noop */
        }
      }
    };
  }, []);

  return <div className={className || 'plot'} ref={divRef} style={style} />;
}
