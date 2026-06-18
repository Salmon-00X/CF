/* =========================================================================
 * AppSidebar — filter rail. Panels: Period · Model · Position · Chart type ·
 * Plant · Colors. The legacy "Trend compare" panel is intentionally gone
 * (its TrendCard consumer is deleted in this redesign). All filter logic is
 * ported verbatim from the old Sidebar.tsx; only the presentation is new.
 * ========================================================================= */
import { CFLogic } from '../../lib/shared';
import { periodKeys, periodLabel, setOf, computePreset, type History } from '../../lib/select';
import type { Filters } from '../../hooks/useFilters';
import {
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { RotateCcw } from 'lucide-react';

interface Props {
  history: History;
  filters: Filters;
  update: (patch: Partial<Filters>) => void;
  onReset: () => void;
}

const PERIOD_PRESETS = [
  { v: 'single', label: 'Single month' },
  { v: '3', label: 'Last 3 mo' },
  { v: '6', label: 'Last 6 mo' },
  { v: 'ytd', label: 'YTD' },
  { v: 'all', label: 'All loaded' },
];

/** Small inline segmented control (Tailwind only — no app.css dependency). */
function Seg<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { v: T; label: string; title?: string }[];
  ariaLabel: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className="flex rounded-md border bg-background p-0.5">
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          title={o.title}
          aria-pressed={value === o.v}
          onClick={() => onChange(o.v)}
          className={cn(
            'flex-1 rounded px-2 py-1 text-xs font-medium transition-colors',
            value === o.v
              ? 'bg-primary text-primary-foreground'
              : 'text-muted-foreground hover:bg-muted'
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        'rounded-full border px-2.5 py-1 text-xs transition-colors',
        on
          ? 'border-accent bg-accent text-accent-foreground'
          : 'border-border bg-background text-muted-foreground hover:bg-muted'
      )}
    >
      {children}
    </button>
  );
}

export default function AppSidebar({ history, filters: S, update, onReset }: Props) {
  const keys: string[] = CFLogic.sortedMonthKeys(history);
  const eff = setOf(periodKeys(history, S));

  let poolRecs: any[] = [];
  periodKeys(history, S).forEach((k) => {
    const m = history.months[k];
    if (m) poolRecs = poolRecs.concat(m.records);
  });
  const plants: string[] = CFLogic.plantsIn(poolRecs);

  const colorRecs = CFLogic.periodRecords(history, periodKeys(history, S), {
    model: S.model,
    plants: S.plantSel,
    file: S.fileSel,
  });
  const colors: string[] = CFLogic.colorsIn(colorRecs);

  function applyPreset(preset: string) {
    update({ periodSel: computePreset(history, S, preset), periodPreset: preset, colorsSel: null });
  }

  function toggleMonth(k: string) {
    const current = new Set(periodKeys(history, S));
    if (current.has(k)) current.delete(k);
    else current.add(k);
    let checked = Array.from(current);
    if (!checked.length && S.monthKey) checked = [S.monthKey];
    const periodSel = checked.length === 1 && checked[0] === S.monthKey ? null : setOf(checked);
    update({ periodSel, periodPreset: periodSel ? 'custom' : 'single', colorsSel: null });
  }

  function togglePlant(p: string) {
    let sel = S.plantSel ? { ...S.plantSel } : null;
    if (!sel) {
      sel = {};
      plants.forEach((x) => (sel![x] = true));
    }
    sel[p] = !sel[p];
    const next = plants.every((x) => sel![x]) ? null : sel;
    update({ plantSel: next, colorsSel: null });
  }

  function toggleColor(c: string) {
    let sel = S.colorsSel ? { ...S.colorsSel } : null;
    if (!sel) {
      sel = {};
      colors.forEach((x) => (sel![x] = true));
    }
    sel[c] = !sel[c];
    const next = colors.every((x) => sel![x]) ? null : sel;
    update({ colorsSel: next });
  }

  return (
    <>
      <SidebarHeader className="flex-row items-center justify-between gap-2 px-3 py-2.5">
        <span className="text-sm font-semibold">Filters &amp; controls</span>
        <Button
          size="icon"
          variant="ghost"
          className="size-7"
          title="Reset all filters"
          onClick={onReset}
        >
          <RotateCcw className="size-4" />
        </Button>
      </SidebarHeader>

      <SidebarContent className="gap-0 px-1">
        {/* Period */}
        <SidebarGroup>
          <SidebarGroupLabel>Period</SidebarGroupLabel>
          <SidebarGroupContent className="space-y-2">
            <div className="flex flex-wrap gap-1.5">
              {PERIOD_PRESETS.map((p) => (
                <button
                  key={p.v}
                  type="button"
                  onClick={() => applyPreset(p.v)}
                  className={cn(
                    'rounded-md border px-2 py-1 text-xs transition-colors',
                    p.v === S.periodPreset
                      ? 'border-accent bg-accent text-accent-foreground'
                      : 'border-border hover:bg-muted'
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border p-2">
              {keys.length ? (
                keys
                  .slice()
                  .reverse()
                  .map((k) => (
                    <label key={k} className="flex cursor-pointer items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        className="accent-primary"
                        checked={!!eff[k]}
                        onChange={() => toggleMonth(k)}
                      />
                      {CFLogic.keyToLabel(k)}
                    </label>
                  ))
              ) : (
                <div className="text-xs text-muted-foreground">Upload data first.</div>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground">
              {S.periodSel ? periodLabel(history, S) : 'Current month only'}
            </p>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Model */}
        <SidebarGroup>
          <SidebarGroupLabel>Model</SidebarGroupLabel>
          <SidebarGroupContent>
            <Seg
              ariaLabel="Model filter"
              value={S.model}
              onChange={(v) => update({ model: v as Filters['model'] })}
              options={[
                { v: 'Both', label: 'Both' },
                { v: 'Ranger', label: 'DBL', title: 'Ranger / DBL (double cab)' },
                { v: 'Raptor', label: 'Raptor' },
              ]}
            />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Position */}
        <SidebarGroup>
          <SidebarGroupLabel>Position</SidebarGroupLabel>
          <SidebarGroupContent>
            <Seg
              ariaLabel="Position filter"
              value={S.orient}
              onChange={(v) => update({ orient: v as Filters['orient'] })}
              options={[
                { v: 'Both', label: 'Both' },
                { v: 'H', label: 'Horizontal' },
                { v: 'V', label: 'Vertical' },
              ]}
            />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Chart type */}
        <SidebarGroup>
          <SidebarGroupLabel>Chart type</SidebarGroupLabel>
          <SidebarGroupContent>
            <Seg
              ariaLabel="Chart type"
              value={S.chartType}
              onChange={(v) => update({ chartType: v as Filters['chartType'] })}
              options={[
                { v: 'box', label: 'Boxplot' },
                { v: 'pareto', label: 'Pareto' },
                { v: 'interval', label: 'Ranking', title: 'Descending mean CF per color' },
              ]}
            />
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Plant */}
        <SidebarGroup>
          <SidebarGroupLabel className="justify-between">
            Plant
            <button
              type="button"
              className="text-[11px] font-normal text-primary hover:underline"
              onClick={() => update({ plantSel: null, colorsSel: null })}
            >
              All plants
            </button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-wrap gap-1.5">
              {plants.length ? (
                plants.map((p) => (
                  <Chip key={p} on={!S.plantSel || !!S.plantSel[p]} onClick={() => togglePlant(p)}>
                    {p}
                  </Chip>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">No plant column in this data.</div>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Colors */}
        <SidebarGroup>
          <SidebarGroupLabel className="justify-between">
            Colors
            <button
              type="button"
              className="text-[11px] font-normal text-primary hover:underline"
              onClick={() => update({ colorsSel: null })}
            >
              All colors
            </button>
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <div className="flex flex-wrap gap-1.5">
              {colors.length ? (
                colors.map((c) => (
                  <Chip key={c} on={!S.colorsSel || !!S.colorsSel[c]} onClick={() => toggleColor(c)}>
                    {c}
                  </Chip>
                ))
              ) : (
                <div className="text-xs text-muted-foreground">Load a month to filter colors.</div>
              )}
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </>
  );
}
