# Bold Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the dashboard to the dashboard-4 shape — navy gradient header, a hero stat strip, and a two-column body (charts + a ranked Action-items panel) — for an obvious, bold look.

**Architecture:** Two new presentational components (`StatStrip`, `ActionItems`) port the existing AndonRibbon/ProblemZones data logic; `App.tsx`'s dashboard branch is recomposed (strip on top, `grid-cols-[2fr_1fr]` below); `AppShell`/`AppTopbar` get a navy gradient header with light controls. Engines, backend, PlotlyChart, and the Data view are untouched.

**Tech Stack:** React 18 + Tailwind v4 + shadcn, Plotly, Electron 33.

## Global Constraints

- **Branch:** `feat/bold-dashboard`.
- **Presentation/composition only:** no edits to `shared/`, `backend/`, `PlotlyChart.tsx`, the Data view (`FilesPanel`/`ReadingsGrid`), data flow, or feature logic.
- **Palette:** Ford navy primary stays; amber (`--accent`) is the highlight; status palette emerald/amber/destructive is one visual language across StatStrip + ActionItems. Amber/status as fills/large numerals, never small body text.
- **Hero strip:** 4 tiles — PASS / WARNING / FAIL counts (same `CFLogic.summarize` + orient filter as AndonRibbon) + **Total readings** (count of the orient-filtered current selection).
- **Action items:** `CFLogic.problemZones(recs, standards, 12)`, click row → `onPick(color)` → Data view filtered (reuse App's `dataFilter`/`setView`).
- **Dashboard drops** `AndonRibbon` + `ProblemZones` from its JSX (files remain in the tree); full editable grid stays in the Data view.
- **Frozen engines; light+dark both; 52 existing tests stay green;** `tsc`+`vite build` clean. Version → 2.4.0.

---

## File Structure

**New:** `frontend/src/components/StatStrip.tsx` (+ `.test.tsx`), `frontend/src/components/ActionItems.tsx` (+ `.test.tsx`).
**Modified:** `frontend/src/App.tsx` (dashboard branch), `frontend/src/components/shell/AppShell.tsx` (gradient header), `frontend/src/components/shell/AppTopbar.tsx` (on-navy restyle), `desktop/package.json` (2.4.0).
**Unchanged (kept, just not on the dashboard):** `AndonRibbon.tsx`, `ProblemZones.tsx`; `ChartCards.tsx` (moves into the left column, no internal change).

_Header styling uses direct Tailwind gradient classes (no new `--header` token — simpler; the spec allowed it "if needed", and it isn't)._

---

### Task 1: StatStrip + ActionItems components (+ tests)

**Files:** Create `frontend/src/components/StatStrip.tsx`, `frontend/src/components/StatStrip.test.tsx`, `frontend/src/components/ActionItems.tsx`, `frontend/src/components/ActionItems.test.tsx`.

**Interfaces:**
- `StatStrip` props `{ history: History; filters: Filters }`.
- `ActionItems` props `{ history: History; filters: Filters; onPick?: (color: string) => void }`.

- [ ] **Step 1: `StatStrip.tsx`**

```tsx
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
```

- [ ] **Step 2: `StatStrip.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import StatStrip from './StatStrip';

vi.mock('../lib/shared', () => ({ CFLogic: { summarize: vi.fn() } }));
vi.mock('../lib/select', () => ({ currentRecords: vi.fn() }));
import { CFLogic } from '../lib/shared';
import { currentRecords } from '../lib/select';

test('renders the four tiles with the right counts', () => {
  (currentRecords as any).mockReturnValue(new Array(50).fill({ orient: 'H' }));
  (CFLogic.summarize as any).mockReturnValue({
    byStatus: {
      PASS: [{ orient: 'H' }, { orient: 'H' }, { orient: 'H' }],
      WARNING: [{ orient: 'H' }],
      FAIL: [{ orient: 'H' }],
    },
  });
  render(<StatStrip history={{ standards: {} } as any} filters={{ orient: 'Both' } as any} />);
  expect(screen.getByText('Pass').previousSibling).toHaveTextContent('3');
  expect(screen.getByText('Warning').previousSibling).toHaveTextContent('1');
  expect(screen.getByText('Fail').previousSibling).toHaveTextContent('1');
  expect(screen.getByText('Readings').previousSibling).toHaveTextContent('50');
});
```

- [ ] **Step 3: `ActionItems.tsx`**

```tsx
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
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
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
```

- [ ] **Step 4: `ActionItems.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import ActionItems from './ActionItems';

vi.mock('../lib/shared', () => ({ CFLogic: { problemZones: vi.fn(), fmtDelta: (d: number) => String(d) } }));
vi.mock('../lib/select', () => ({ currentRecords: () => [] }));
import { CFLogic } from '../lib/shared';

beforeEach(() => {
  (CFLogic.problemZones as any).mockReturnValue({
    total: 2,
    list: [
      { status: 'FAIL', color: 'Shadow Black', zone: '01 RRHOOD', orient: 'H', devMin: -5 },
      { status: 'WARNING', color: 'Code Orange', zone: '02 ROOF', orient: 'V', devMin: -1 },
    ],
  });
});

const props = { history: { standards: {} } as any, filters: { orient: 'Both' } as any };

test('clicking an item calls onPick with its color', async () => {
  const user = userEvent.setup();
  const onPick = vi.fn();
  render(<ActionItems {...props} onPick={onPick} />);
  await user.click(screen.getByText('Shadow Black'));
  expect(onPick).toHaveBeenCalledWith('Shadow Black');
});

test('shows the all-clear state when there are no problem zones', () => {
  (CFLogic.problemZones as any).mockReturnValue({ total: 0, list: [] });
  render(<ActionItems {...props} />);
  expect(screen.getByText(/every checkzone meets/i)).toBeInTheDocument();
});
```

- [ ] **Step 5: Verify** — `npm test -w @cf-wavescan/frontend` (new 4 tests pass + the prior 15) and `cd frontend && npx tsc --noEmit` exit 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/StatStrip.tsx frontend/src/components/StatStrip.test.tsx frontend/src/components/ActionItems.tsx frontend/src/components/ActionItems.test.tsx
git commit -m "feat(frontend): StatStrip hero tiles + ActionItems panel (+tests)"
```

---

### Task 2: Recompose the dashboard (`App.tsx`)

**Files:** Modify `frontend/src/App.tsx`.

**Interfaces:** Consumes `StatStrip`, `ActionItems` (Task 1). Reuses existing `dataFilter`/`setView`.

- [ ] **Step 1: Swap imports** — remove `AndonRibbon` and `ProblemZones` imports; add:
```tsx
import StatStrip from './components/StatStrip';
import ActionItems from './components/ActionItems';
```

- [ ] **Step 2: Replace the dashboard branch body.** Change the `view !== 'data'` block from the
current `DropZone` + `AndonRibbon` + `ProblemZones` + `ChartCards` to:
```tsx
          <>
            <DropZone hasData={hasData} onFile={onFile} />
            {hasData && (
              <>
                <StatStrip history={history} filters={filters} />
                <div className="grid grid-cols-1 gap-3 xl:grid-cols-[2fr_1fr]">
                  <ChartCards history={history} filters={filters} />
                  <ActionItems
                    history={history}
                    filters={filters}
                    onPick={(c) => {
                      setDataFilter(c);
                      setView('data');
                    }}
                  />
                </div>
              </>
            )}
          </>
```

- [ ] **Step 3: Verify** — `cd frontend && npx tsc --noEmit` exit 0 (no unused-import errors — `AndonRibbon`/`ProblemZones` imports are gone); `npm run build -w @cf-wavescan/frontend` succeeds; `npm test -w @cf-wavescan/frontend` still green (ProblemZones.test still passes — the component file is untouched).

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): recompose dashboard — hero strip + charts/action-items columns"
```

---

### Task 3: Navy gradient header

**Files:** Modify `frontend/src/components/shell/AppShell.tsx`, `frontend/src/components/shell/AppTopbar.tsx`.

- [ ] **Step 1: `AppShell.tsx` — gradient header.** Change the `<header>` className from
`sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/80`
to:
```tsx
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b border-primary/30 bg-gradient-to-r from-primary to-[hsl(211_59%_22%)] px-4 text-primary-foreground">
```

- [ ] **Step 2: `AppTopbar.tsx` — restyle controls for the navy band.** Apply these className
changes (the structure/handlers stay identical):
  - `SidebarTrigger`: add `text-primary-foreground hover:bg-white/10` → `className="-ml-1 text-primary-foreground hover:bg-white/10"`.
  - `Separator`: `className="mr-1 h-6 bg-white/30"`.
  - View-switch container: `className="flex rounded-md border border-white/25 bg-white/10 p-0.5"`; each button active branch → `bg-background text-foreground`, inactive → `text-primary-foreground/80 hover:bg-white/10`.
  - Brand mark keeps `bg-primary` → change to `bg-white/15 text-primary-foreground`; title text inherits `text-primary-foreground`; sub `text-primary-foreground/70`.
  - Both `SelectTrigger`s: add `border-white/25 bg-white/10 text-primary-foreground` to their className (keep the `h-9 w-[...]`).
  - DB-status dot text: `text-primary-foreground/80`.
  - Import `Button`: `className="bg-accent text-accent-foreground hover:bg-accent/90"` (amber primary on navy).
  - Standards `Button variant="outline"`: `className="border-white/30 bg-transparent text-primary-foreground hover:bg-white/10"`.
  - Version label: `text-primary-foreground/70`.

- [ ] **Step 3: Verify** — `cd frontend && npx tsc --noEmit` exit 0; `npm run build -w @cf-wavescan/frontend` succeeds. (Visual contrast is confirmed in the Task-4 smoke; near-white on navy passes AA.)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shell/AppShell.tsx frontend/src/components/shell/AppTopbar.tsx
git commit -m "feat(frontend): navy gradient header with light, amber-accented controls"
```

---

### Task 4: Verify + 2.4.0 build

**Files:** Modify `desktop/package.json`.

- [ ] **Step 1: Bump** `2.3.0` → `2.4.0` in `desktop/package.json`.
- [ ] **Step 2: All tests** — `npm test -w @cf-wavescan/shared` (15), `npm test -w @cf-wavescan/backend` (22), `npm test -w @cf-wavescan/frontend` (19: prior 15 + new 4).
- [ ] **Step 3:** `cd frontend && npx tsc --noEmit` exit 0; `npm run build -w @cf-wavescan/frontend` clean.
- [ ] **Step 4: Desktop installer** — `npm run dist:win -w @cf-wavescan/desktop` → `Setup 2.4.0.exe`.
- [ ] **Step 5: Packaged backend smoke** — Electron `ELECTRON_RUN_AS_NODE=1` + temp DB/PORT → `/api/months` 200, 127.0.0.1.
- [ ] **Step 6: Manual smoke (user)** — navy gradient header obvious; hero strip with 4 colored tiles; charts left + Action-items right; clicking an action item jumps to the filtered Data view; dark mode legible; all features intact.
- [ ] **Step 7: Commit**

```bash
git add desktop/package.json
git commit -m "chore(desktop): bump to 2.4.0 (bold dashboard redesign)"
```

---

## Self-Review

**Spec coverage:** navy gradient header (T3); hero strip with PASS/WARN/FAIL + Total readings (T1 StatStrip, T2 wiring); two-column charts + ActionItems with click-through (T1 ActionItems, T2); drop AndonRibbon/ProblemZones from dashboard, keep files (T2); amber/status visual language (T1 tiles + dots, T3 amber import button); frozen engines/backend/PlotlyChart/Data view (no tasks touch them); light+dark (token-based colors + explicit dark variants in components); StatStrip/ActionItems tests (T1); verify incl. 19 frontend tests + 2.4.0 build (T4). All spec sections mapped.

**Placeholder scan:** Task 1 components + tests are complete code; Tasks 2–3 give exact import swaps and exact className strings (static Tailwind classes — `border-l-emerald-500` etc., no dynamically-built class names that Tailwind couldn't see). No TBDs.

**Type consistency:** `StatStrip`/`ActionItems` props (`history`,`filters`,`onPick?`) match the App call sites in T2; both consume `currentRecords` + `CFLogic.summarize`/`problemZones`/`fmtDelta` exactly as the originals do; `onPick(color)` mirrors the existing ProblemZones contract and App's `setDataFilter`/`setView`; status keys `PASS|WARNING|FAIL` match `summarize.byStatus`. ChartCards unchanged.
