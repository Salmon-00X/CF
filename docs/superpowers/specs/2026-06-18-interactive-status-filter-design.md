# Interactive Status Filter + Layout Cleanup — Design Spec

**Date:** 2026-06-18
**Branch:** `feat/interactive-status-filter` (created at implementation)
**Status:** Approved design, pending spec review
**Milestone:** Post-v2.4.0 — interactive dashboard

---

## Context

On the v2.4.0 bold dashboard the user wants three changes: drop the 4th "Readings" tile,
clean the layout into a single vertical stack, and make the Pass/Warning/Fail tiles **clickable
filters** that drive both the charts and a detail list. The data is already there:
`CFCore.zoneStatuses(recs, standards)` returns one row per checkzone with a `status`
(PASS/WARNING/FAIL/null) plus `color, zone, orient, cf, devFord, devMin` — so tiles, list, and
chart can all key off the same zone-level statuses, consistently.

### Decisions locked (from brainstorming)

- **Tiles:** remove "Readings" → Pass / Warning / Fail only, full-width top row, clickable toggles.
- **Tile counts become zone-level** (count of checkzones per status via `zoneStatuses`) so the
  number equals what clicking reveals — a deliberate change from the current color-group counts.
- **Layout:** single vertical stack — tiles → charts (full width) → detail list below (drop the
  two-column grid).
- **Interactive filter:** `statusFilter` state in App; clicking a tile filters charts + list to
  that status; clicking the active tile clears. Default (none selected) = all worst checkzones.
- **Detail list = checkzone rows** (status dot · color · zone · position · CF · Δ-vs-min), row
  click → Data view filtered to that color (kept).
- Engines/backend/PlotlyChart/Data view frozen. Version → 2.5.0.

---

## 1. App state + wiring (`frontend/src/App.tsx`)

- Add `const [statusFilter, setStatusFilter] = useState<'PASS' | 'WARNING' | 'FAIL' | null>(null)`.
- Reset `statusFilter` to `null` whenever the month changes (in `onMonthChange`) so a stale filter
  doesn't carry across months. (Other filters already reset there.)
- Dashboard branch becomes a vertical stack:
  ```
  <DropZone … />
  {hasData && (
    <>
      <StatStrip history filters active={statusFilter}
                 onSelect={(s) => setStatusFilter((cur) => (cur === s ? null : s))} />
      <ChartCards history filters statusFilter={statusFilter} />
      <CheckzoneList history filters statusFilter={statusFilter}
                     onPick={(c) => { setDataFilter(c); setView('data'); }} />
    </>
  )}
  ```
  No `xl:grid-cols-[2fr_1fr]` wrapper — plain stack with `gap-3` (the outer `<main>` already gaps).

## 2. StatStrip — 3 clickable tiles, zone-level counts (`StatStrip.tsx`)

- Props: `{ history; filters; active: Status | null; onSelect: (s: Status) => void }`.
- Compute counts from `CFCore.zoneStatuses(recs, standards)` where `recs = currentRecords` filtered
  by orient (same orient rule as today). `count(status) = zones.filter(z => z.status === status).length`.
  (Drop the `CFLogic.summarize` group-count path.)
- Render exactly 3 tiles (Pass/Warning/Fail), `grid-cols-3` (responsive `grid-cols-1 sm:grid-cols-3`).
- Each tile is a `<button>`: status-colored (emerald/amber/destructive) border + number + label + icon;
  when `active === status`, add a filled/ring treatment (e.g. `ring-2 ring-<status>` + tinted bg);
  `aria-pressed={active === status}`, `cursor-pointer`, visible `focus-visible:ring`.
- Remove the Database/"Readings" tile and its import.

## 3. ChartCards — filter by status (`ChartCards.tsx`)

- New optional prop `statusFilter?: 'PASS' | 'WARNING' | 'FAIL' | null`.
- After `recs = currentRecords(history, S)`, if `statusFilter` is set, filter records to that zone
  status (index-aligned, since `zoneStatuses` is `records.map`):
  ```ts
  if (statusFilter) {
    const zs = CFCore.zoneStatuses(recs, history.standards);
    recs = recs.filter((_, i) => zs[i].status === statusFilter);
  }
  ```
  Add `CFCore` to the import (currently CFLogic only). The per-orient split + plot builders are
  unchanged; they just receive the filtered records.
- Empty case: if the filter leaves no records for an orientation, the existing `emptyHtml`
  ("No … readings for this selection.") already covers it.

## 4. CheckzoneList — detail rows (evolve `ActionItems.tsx` → rename `CheckzoneList.tsx`)

- Props: `{ history; filters; statusFilter?: Status | null; onPick?: (color: string) => void }`.
- `recs = currentRecords` filtered by orient.
- **Default (statusFilter null):** keep today's behavior — `CFLogic.problemZones(recs, standards, 12)`
  worst-first list; title "Action items — fix first".
- **Filtered:** rows from `CFCore.zoneStatuses(recs, standards).filter(z => z.status === statusFilter)`,
  sorted worst-first by `devMin` (ascending) for FAIL/WARNING, by color/zone for PASS; title e.g.
  "FAIL checkzones (7)". Cap the rendered list (e.g. 50) with a "…and N more — see the Data view."
  footer when exceeded.
- Row = status dot (`DOT[status]`) · color (medium) · `zone · orient` (muted) · `Δmin` mono (right).
  Row is a focusable `<button>` (keep the `focus-visible:ring` a11y fix); `onPick(color)` → Data view.
- Keep `ActionItems.test.tsx` semantics by moving/renaming to `CheckzoneList.test.tsx`.

## 5. Data flow

App owns `statusFilter`. StatStrip reflects/sets it (toggle). ChartCards and CheckzoneList read it
and filter their `currentRecords` by zone status. No engine/backend change; the same `history` +
`filters` inputs flow as today, plus the one new prop.

## 6. Edge cases

- **No matching zones** for a clicked status: chart shows its empty state; list shows "No PASS
  checkzones for this selection." Tile still highlightable; clicking again clears.
- **Month/selection change** clears `statusFilter` (App `onMonthChange`).
- **`status: null`** rows from `zoneStatuses` (color with no standard) never match a PASS/WARNING/FAIL
  filter, so they're naturally excluded — correct.

## 7. Testing

- **StatStrip.test:** update to 3 tiles; mock `CFCore.zoneStatuses` → counts; assert the 3 numbers;
  assert clicking a tile calls `onSelect('FAIL')` and that `active` renders the pressed state.
- **CheckzoneList.test:** default shows problemZones rows (mock `CFLogic.problemZones`); with
  `statusFilter="FAIL"` shows `zoneStatuses`-filtered rows (mock `CFCore.zoneStatuses`); row click
  calls `onPick(color)`.
- 15 CFLogic + 22 backend untouched/green; `tsc` + `vite build` clean; CI green.
- Desktop build + manual smoke (user): 3 tiles; click Fail → chart + list show only failing
  checkzones, count matches; click again clears; dark mode + responsive intact.

## File structure

**New:** `frontend/src/components/CheckzoneList.tsx` (+ `CheckzoneList.test.tsx`).
**Modified:** `frontend/src/App.tsx`, `frontend/src/components/StatStrip.tsx` (+ `StatStrip.test.tsx`),
`frontend/src/components/ChartCards.tsx`, `desktop/package.json` (2.5.0).
**Removed:** `frontend/src/components/ActionItems.tsx` (+ `ActionItems.test.tsx`) — superseded by
CheckzoneList (rename).

## Risks

- **Count semantics change** (group → zone level): intentional + flagged; the tiles now read as
  checkzone counts. Verify the smoke shows tile number == filtered list length.
- **Index alignment** of `zoneStatuses` to `recs`: it is `records.map`, so 1:1 by index — the
  `recs.filter((_, i) => zs[i].status === …)` is safe as long as the same `recs` array is passed to
  both. Keep them the same reference.
- **Renaming ActionItems → CheckzoneList:** update the App import and the test filename; no other
  consumer exists (grep to confirm during the plan).
- **Scope:** dashboard interactivity only; no new analytics, no engine change.
