# Interactive Status Filter + Layout Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the 3 status tiles clickable filters that drive the charts + a checkzone detail list, drop the Readings tile, and stack the dashboard vertically.

**Architecture:** A `statusFilter` state in App is set by clickable `StatStrip` tiles (zone-level counts via `CFCore.zoneStatuses`) and read by `ChartCards` (filters records by zone status before plotting) and `CheckzoneList` (lists the matching checkzone rows; default = worst zones). Engines/backend/PlotlyChart/Data view unchanged.

**Tech Stack:** React 18 + Tailwind v4 + shadcn, Plotly, Electron 33.

## Global Constraints

- **Branch:** `feat/interactive-status-filter`.
- **Presentation/dashboard only:** no edits to `shared/`, `backend/`, `PlotlyChart.tsx`, Data view, data flow, engines.
- **Status type** is exactly `'PASS' | 'WARNING' | 'FAIL'`; filter state is that or `null`.
- **Tile counts are zone-level:** `CFCore.zoneStatuses(recs, standards).filter(z => z.status === S).length` (orient-filtered recs) — number must equal the filtered list length.
- **`zoneStatuses` is `records.map`** → index-aligned 1:1 with the same `recs` array; filter charts via `recs.filter((_, i) => zs[i].status === statusFilter)` using the **same** `recs` reference.
- **Toggle:** clicking the active tile clears (`null`); changing month clears it.
- **Frozen tests:** 15 CFLogic + 22 backend stay green; `tsc` + `vite build` clean; CI green. Version → 2.5.0.
- **Progress updates:** after each task, post a short summary of the UI + filtering change (user requirement).

---

## File Structure

**New:** `frontend/src/components/CheckzoneList.tsx` (+ `CheckzoneList.test.tsx`).
**Modified:** `frontend/src/components/StatStrip.tsx` (+ `StatStrip.test.tsx`), `frontend/src/components/ChartCards.tsx`, `frontend/src/App.tsx`, `desktop/package.json`.
**Removed:** `frontend/src/components/ActionItems.tsx` (+ `ActionItems.test.tsx`) — superseded by CheckzoneList.

---

### Task 1: StatStrip — 3 clickable tiles, zone-level counts

**Files:** Modify `frontend/src/components/StatStrip.tsx`, `frontend/src/components/StatStrip.test.tsx`.

**Interfaces:** Produces `StatStrip` props `{ history; filters; active: Status | null; onSelect: (s: Status) => void }` (`Status = 'PASS'|'WARNING'|'FAIL'`).

- [ ] **Step 1: Replace `StatStrip.tsx`**

```tsx
/* StatStrip — three clickable status tiles (Pass / Warning / Fail). Counts are
   zone-level (CFCore.zoneStatuses) so a tile's number equals what clicking it
   reveals. Clicking toggles the dashboard's status filter. */
import { CFCore } from '../lib/shared';
import { currentRecords, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';
import { cn } from '@/lib/utils';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

type Status = 'PASS' | 'WARNING' | 'FAIL';

interface Props {
  history: History;
  filters: Filters;
  active: Status | null;
  onSelect: (s: Status) => void;
}

const TILES: {
  status: Status;
  label: string;
  Icon: typeof CheckCircle2;
  border: string;
  val: string;
  ring: string;
  tint: string;
}[] = [
  { status: 'PASS', label: 'Pass', Icon: CheckCircle2, border: 'border-l-emerald-500', val: 'text-emerald-600 dark:text-emerald-400', ring: 'ring-emerald-500', tint: 'bg-emerald-500/10' },
  { status: 'WARNING', label: 'Warning', Icon: AlertTriangle, border: 'border-l-amber-500', val: 'text-amber-600 dark:text-amber-400', ring: 'ring-amber-500', tint: 'bg-amber-500/10' },
  { status: 'FAIL', label: 'Fail', Icon: XCircle, border: 'border-l-destructive', val: 'text-destructive', ring: 'ring-destructive', tint: 'bg-destructive/10' },
];

export default function StatStrip({ history, filters: S, active, onSelect }: Props) {
  let recs = currentRecords(history, S);
  if (S.orient !== 'Both') recs = recs.filter((r: any) => r.orient === S.orient);
  const zones = CFCore.zoneStatuses(recs, history.standards);
  const count = (st: Status) => zones.filter((z: any) => z.status === st).length;

  return (
    <section className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Status summary (click to filter)">
      {TILES.map((t) => {
        const on = active === t.status;
        return (
          <button
            key={t.status}
            type="button"
            aria-pressed={on}
            onClick={() => onSelect(t.status)}
            className={cn(
              'rounded-xl border border-l-4 bg-card p-4 text-left text-card-foreground shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-ring',
              t.border,
              on ? cn('ring-2', t.ring, t.tint) : 'cursor-pointer hover:bg-muted/40'
            )}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className={cn('font-mono text-4xl font-bold tabular-nums', t.val)}>{count(t.status)}</div>
                <div className="mt-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">{t.label}</div>
              </div>
              <t.Icon className={cn('size-8 opacity-25', t.val)} aria-hidden="true" />
            </div>
          </button>
        );
      })}
    </section>
  );
}
```

- [ ] **Step 2: Replace `StatStrip.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import StatStrip from './StatStrip';

vi.mock('../lib/shared', () => ({ CFCore: { zoneStatuses: vi.fn() } }));
vi.mock('../lib/select', () => ({ currentRecords: vi.fn() }));
import { CFCore } from '../lib/shared';
import { currentRecords } from '../lib/select';

beforeEach(() => {
  (currentRecords as any).mockReturnValue([]);
  (CFCore.zoneStatuses as any).mockReturnValue([
    { status: 'PASS', orient: 'H' },
    { status: 'PASS', orient: 'H' },
    { status: 'WARNING', orient: 'H' },
    { status: 'FAIL', orient: 'H' },
  ]);
});

const base = { history: { standards: {} } as any, filters: { orient: 'Both' } as any };

test('renders three tiles with zone-level counts', () => {
  render(<StatStrip {...base} active={null} onSelect={vi.fn()} />);
  expect(screen.getByText('Pass').previousSibling).toHaveTextContent('2');
  expect(screen.getByText('Warning').previousSibling).toHaveTextContent('1');
  expect(screen.getByText('Fail').previousSibling).toHaveTextContent('1');
  expect(screen.queryByText('Readings')).not.toBeInTheDocument();
});

test('clicking a tile calls onSelect with its status', async () => {
  const user = userEvent.setup();
  const onSelect = vi.fn();
  render(<StatStrip {...base} active={null} onSelect={onSelect} />);
  await user.click(screen.getByText('Fail'));
  expect(onSelect).toHaveBeenCalledWith('FAIL');
});

test('the active tile is marked pressed', () => {
  render(<StatStrip {...base} active="WARNING" onSelect={vi.fn()} />);
  const warnTile = screen.getByText('Warning').closest('button')!;
  expect(warnTile).toHaveAttribute('aria-pressed', 'true');
});
```

- [ ] **Step 3: Verify + progress update** — `npm test -w @cf-wavescan/frontend` (StatStrip 3 tests pass) + `cd frontend && npx tsc --noEmit` exit 0. Post a 2-line progress update: "StatStrip → 3 clickable tiles, zone-level counts, Readings removed."

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/StatStrip.tsx frontend/src/components/StatStrip.test.tsx
git commit -m "feat(frontend): StatStrip 3 clickable tiles with zone-level counts"
```

---

### Task 2: CheckzoneList (evolve ActionItems) + remove ActionItems

**Files:** Create `frontend/src/components/CheckzoneList.tsx`, `frontend/src/components/CheckzoneList.test.tsx`; delete `frontend/src/components/ActionItems.tsx`, `frontend/src/components/ActionItems.test.tsx`.

**Interfaces:** Produces `CheckzoneList` props `{ history; filters; statusFilter?: Status | null; onPick?: (color: string) => void }`.

- [ ] **Step 1: Create `CheckzoneList.tsx`**

```tsx
/* CheckzoneList — checkzone detail rows. Default (no statusFilter) = worst-first
   problem zones (today's Action items). With a statusFilter = every checkzone of
   that status (CFCore.zoneStatuses). Row click → edit that color in the Data view. */
import { CFCore, CFLogic } from '../lib/shared';
import { currentRecords, type History } from '../lib/select';
import type { Filters } from '../hooks/useFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type Status = 'PASS' | 'WARNING' | 'FAIL';

interface Props {
  history: History;
  filters: Filters;
  statusFilter?: Status | null;
  onPick?: (color: string) => void;
}

const DOT: Record<string, string> = { FAIL: 'bg-destructive', WARNING: 'bg-amber-500', PASS: 'bg-emerald-500' };
const CAP = 50;

export default function CheckzoneList({ history, filters: S, statusFilter, onPick }: Props) {
  let recs = currentRecords(history, S);
  if (S.orient !== 'Both') recs = recs.filter((r: any) => r.orient === S.orient);

  let rows: any[];
  let total: number;
  let title: string;
  if (statusFilter) {
    rows = CFCore.zoneStatuses(recs, history.standards).filter((z: any) => z.status === statusFilter);
    rows.sort((a: any, b: any) =>
      statusFilter === 'PASS'
        ? a.color.localeCompare(b.color) || a.zone.localeCompare(b.zone)
        : a.devMin - b.devMin
    );
    total = rows.length;
    title = `${statusFilter[0]}${statusFilter.slice(1).toLowerCase()} checkzones (${total})`;
  } else {
    const pb = CFLogic.problemZones(recs, history.standards, CAP);
    rows = pb.list;
    total = pb.total;
    title = 'Action items — fix first';
  }
  const shown = rows.slice(0, CAP);

  return (
    <Card className="flex flex-col">
      <CardHeader className="py-3">
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <div className="rounded-md bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-400">
            {statusFilter
              ? `No ${statusFilter.toLowerCase()} checkzones for this selection.`
              : '✓ Every checkzone meets the average target for this selection.'}
          </div>
        ) : (
          <ul className="space-y-1">
            {shown.map((z: any, i: number) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={onPick ? () => onPick(z.color) : undefined}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    onPick && 'cursor-pointer hover:bg-accent/15'
                  )}
                >
                  <span className={cn('size-2 shrink-0 rounded-full', DOT[z.status] || 'bg-muted-foreground')} aria-hidden="true" />
                  <span className="font-medium">{z.color}</span>
                  <span className="text-xs text-muted-foreground">
                    {z.zone} · {z.orient}
                  </span>
                  <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
                    {CFLogic.fmtDelta(z.devMin)}
                  </span>
                </button>
              </li>
            ))}
            {total > shown.length && (
              <li className="px-2 pt-1 text-xs text-muted-foreground">
                …and {total - shown.length} more — see the Data view.
              </li>
            )}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Create `CheckzoneList.test.tsx`**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CheckzoneList from './CheckzoneList';

vi.mock('../lib/shared', () => ({
  CFCore: { zoneStatuses: vi.fn() },
  CFLogic: { problemZones: vi.fn(), fmtDelta: (d: number) => String(d) },
}));
vi.mock('../lib/select', () => ({ currentRecords: () => [] }));
import { CFCore, CFLogic } from '../lib/shared';

const base = { history: { standards: {} } as any, filters: { orient: 'Both' } as any };

test('default shows worst problem-zone rows', () => {
  (CFLogic.problemZones as any).mockReturnValue({
    total: 1,
    list: [{ status: 'FAIL', color: 'Shadow Black', zone: '01 RRHOOD', orient: 'H', devMin: -5 }],
  });
  render(<CheckzoneList {...base} />);
  expect(screen.getByText('Action items — fix first')).toBeInTheDocument();
  expect(screen.getByText('Shadow Black')).toBeInTheDocument();
});

test('with a statusFilter shows that status’s checkzones and titles the count', async () => {
  const user = userEvent.setup();
  const onPick = vi.fn();
  (CFCore.zoneStatuses as any).mockReturnValue([
    { status: 'FAIL', color: 'Shadow Black', zone: '01 RRHOOD', orient: 'H', devMin: -5 },
    { status: 'PASS', color: 'Arctic White', zone: '02 ROOF', orient: 'H', devMin: 4 },
  ]);
  render(<CheckzoneList {...base} statusFilter="FAIL" onPick={onPick} />);
  expect(screen.getByText('Fail checkzones (1)')).toBeInTheDocument();
  expect(screen.queryByText('Arctic White')).not.toBeInTheDocument();
  await user.click(screen.getByText('Shadow Black'));
  expect(onPick).toHaveBeenCalledWith('Shadow Black');
});

test('empty state for a status with no matching zones', () => {
  (CFCore.zoneStatuses as any).mockReturnValue([{ status: 'PASS', color: 'X', zone: 'z', orient: 'H', devMin: 1 }]);
  render(<CheckzoneList {...base} statusFilter="FAIL" />);
  expect(screen.getByText(/no fail checkzones/i)).toBeInTheDocument();
});
```

- [ ] **Step 3: Remove the superseded ActionItems**

```bash
git rm frontend/src/components/ActionItems.tsx frontend/src/components/ActionItems.test.tsx
grep -rn "ActionItems" frontend/src || echo "no ActionItems refs"
```
Expected: the only remaining reference is App.tsx's import (replaced in Task 4) — note it; it is fixed there.

- [ ] **Step 4: Verify + progress update** — `npm test -w @cf-wavescan/frontend` (CheckzoneList 3 tests pass; App not yet building because its ActionItems import is stale — that's fixed in Task 4, so run only this file: `npx vitest run src/components/CheckzoneList.test.tsx --root frontend`). Post update: "CheckzoneList added (status-aware detail rows); ActionItems removed."

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/CheckzoneList.tsx frontend/src/components/CheckzoneList.test.tsx
git commit -m "feat(frontend): CheckzoneList status-aware detail rows (replaces ActionItems)"
```

---

### Task 3: ChartCards — filter records by status

**Files:** Modify `frontend/src/components/ChartCards.tsx`.

**Interfaces:** Consumes `statusFilter?: Status | null` (new prop). Uses `CFCore.zoneStatuses`.

- [ ] **Step 1: Add the import + prop + filter.** Change the import line `import { CFLogic } from '../lib/shared';` to `import { CFCore, CFLogic } from '../lib/shared';`. Add to `Props`:
```tsx
  statusFilter?: 'PASS' | 'WARNING' | 'FAIL' | null;
```
Destructure it: `export default function ChartCards({ history, filters: S, statusFilter }: Props) {`. Right after `const recs = currentRecords(history, S);`, insert:
```tsx
  let recs = currentRecords(history, S);
  if (statusFilter) {
    const zs = CFCore.zoneStatuses(recs, history.standards);
    recs = recs.filter((_, i) => zs[i].status === statusFilter);
  }
```
(Change the existing `const recs` to `let recs` so it can be reassigned. The rest of the component — per-orient split + `buildChart` — is unchanged and now receives the filtered `recs`.)

- [ ] **Step 2: Verify + progress update** — `cd frontend && npx tsc --noEmit` exit 0; `npm run build -w @cf-wavescan/frontend` succeeds. Post update: "ChartCards now filters its records by the active status before plotting."

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChartCards.tsx
git commit -m "feat(frontend): ChartCards filters records by active status"
```

---

### Task 4: App wiring — state, stack layout, reset, swap imports

**Files:** Modify `frontend/src/App.tsx`.

- [ ] **Step 1: Swap imports** — remove `import StatStrip …`? No: keep StatStrip, remove `import ActionItems from './components/ActionItems';`, add `import CheckzoneList from './components/CheckzoneList';`. (StatStrip import stays.)

- [ ] **Step 2: Add state** next to `dataFilter`:
```tsx
  const [statusFilter, setStatusFilter] = useState<'PASS' | 'WARNING' | 'FAIL' | null>(null);
```

- [ ] **Step 3: Clear the filter on month change.** In `onMonthChange`, add `setStatusFilter(null);` (alongside the existing `update(...)` call) so a status filter doesn't persist across months.

- [ ] **Step 4: Replace the dashboard `hasData` block** (the StatStrip + two-column grid added in the bold-dashboard slice) with the vertical stack:
```tsx
            {hasData && (
              <>
                <StatStrip
                  history={history}
                  filters={filters}
                  active={statusFilter}
                  onSelect={(s) => setStatusFilter((cur) => (cur === s ? null : s))}
                />
                <ChartCards history={history} filters={filters} statusFilter={statusFilter} />
                <CheckzoneList
                  history={history}
                  filters={filters}
                  statusFilter={statusFilter}
                  onPick={(c) => {
                    setDataFilter(c);
                    setView('data');
                  }}
                />
              </>
            )}
```
(Removes the `<div className="grid … xl:grid-cols-[2fr_1fr]">` wrapper and the old `ActionItems`; the three children stack via the `<main>`'s existing `gap-3`.)

- [ ] **Step 5: Verify + progress update** — `cd frontend && npx tsc --noEmit` exit 0 (no stale ActionItems import); `npm run build -w @cf-wavescan/frontend` succeeds; `npm test -w @cf-wavescan/frontend` all green. Post update: "App: added statusFilter state (toggle + reset on month change); dashboard is now tiles → charts → list, wired to the filter."

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat(frontend): wire status filter — clickable tiles drive charts + checkzone list; vertical stack"
```

---

### Task 5: Verify + 2.5.0 build

**Files:** Modify `desktop/package.json`.

- [ ] **Step 1: Bump** `2.4.0` → `2.5.0` in `desktop/package.json`.
- [ ] **Step 2: All tests** — `npm test -w @cf-wavescan/shared` (15), `npm test -w @cf-wavescan/backend` (22), `npm test -w @cf-wavescan/frontend` (StatStrip 3 + CheckzoneList 3 + the other prior suites).
- [ ] **Step 3:** `cd frontend && npx tsc --noEmit` exit 0; `npm run build -w @cf-wavescan/frontend` clean.
- [ ] **Step 4: Desktop installer** — `npm run dist:win -w @cf-wavescan/desktop` → `Setup 2.5.0.exe`.
- [ ] **Step 5: Packaged backend smoke** — Electron `ELECTRON_RUN_AS_NODE=1` + temp DB/PORT → `/api/months` 200, 127.0.0.1.
- [ ] **Step 6: Manual smoke (user)** — 3 tiles; click Fail → charts + list show only failing checkzones and the count matches the tile; click Fail again clears; switch month clears; dark mode + responsive intact.
- [ ] **Step 7: Commit**

```bash
git add desktop/package.json
git commit -m "chore(desktop): bump to 2.5.0 (interactive status filter)"
```

---

## Self-Review

**Spec coverage:** remove Readings + 3 clickable tiles + zone counts (T1); vertical stack layout (T4 Step 4); statusFilter state + toggle + month-reset (T4); charts filter by status (T3); checkzone detail list default + filtered + row click (T2); ActionItems→CheckzoneList rename/remove (T2 + T4 import swap); tests for StatStrip + CheckzoneList (T1, T2); verify + 2.5.0 (T5). All spec sections mapped.

**Placeholder scan:** every component + test is complete code; the `recs.filter((_, i) => zs[i].status === …)` index-aligned pattern is spelled out; no TBDs.

**Type consistency:** `Status` union identical across StatStrip/CheckzoneList/ChartCards/App; `StatStrip` props `{active, onSelect}` match the App call; `CheckzoneList`/`ChartCards` both take `statusFilter?: Status | null` consumed exactly as passed; `onPick(color)` mirrors the existing Data-view wiring (`setDataFilter`/`setView`); `zoneStatuses` row fields (`status,color,zone,orient,devMin`) match `core.js` and are used consistently.
