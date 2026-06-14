/* FilterBar (.filter-bar) — recap chips of the active selection. Port of
 * renderFilterBar(). */
import { CFCore } from '../lib/shared';
import { periodLabel, plantsLabel, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';

interface Props {
  history: History;
  filters: Filters;
  onReset: () => void;
}

function Chip({ k, v }: { k: string; v: string }) {
  return (
    <span className="fb-chip">
      <span className="fb-k">{k}</span>
      {v}
    </span>
  );
}

export default function FilterBar({ history, filters: S, onReset }: Props) {
  const colorN = S.colorsSel ? Object.keys(S.colorsSel).filter((c) => S.colorsSel![c]).length : 0;
  return (
    <div className="filter-bar" aria-live="polite">
      <span className="eyebrow">View</span>
      <div className="filter-bar-chips">
        <Chip k="Period" v={periodLabel(history, S)} />
        <Chip k="Plant" v={plantsLabel(S)} />
        {S.model !== 'Both' && <Chip k="Model" v={CFCore.modelLabel(S.model)} />}
        {S.orient !== 'Both' && <Chip k="Position" v={S.orient === 'H' ? 'Horizontal' : 'Vertical'} />}
        {S.colorsSel && <Chip k="Colors" v={colorN + ' selected'} />}
        {S.fileSel && <Chip k="File" v={S.fileSel} />}
      </div>
      <span className="spacer" />
      <button className="link" type="button" title="Clear non-default filters" onClick={onReset}>
        ⟲ Reset
      </button>
    </div>
  );
}
