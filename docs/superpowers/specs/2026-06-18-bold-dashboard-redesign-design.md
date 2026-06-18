# Bold Dashboard Redesign (dashboard-4 restructure) — Design Spec

**Date:** 2026-06-18
**Branch:** `feat/bold-dashboard` (created at implementation)
**Status:** Approved design, pending spec review
**Milestone:** Post-v2.3.0 — bolder UI

---

## Context

The v2.3.0 data-dense restyle was deliberately subtle (amber only on interaction, Fira ≈ system
sans at a glance), so at rest the dashboard looked unchanged. The user wants a **bold, obvious**
transformation in the efferd `dashboard-4` shape: a navy gradient header, a hero metric strip,
and a two-column body (charts left, a ranked "Action items" panel right). This is a **dashboard
recomposition + bolder chrome** — not an engine/data/feature change. Everything still runs on the
existing shadcn components and CFLogic/CFCore engines; the Data view and all editing are untouched.

### Decisions locked (from brainstorming)

- **Direction:** dashboard-4 restructure (the option the user picked from the sketches).
- **Header:** Ford-navy **gradient** band, light controls.
- **Hero strip:** 4 status-colored stat tiles — PASS / WARNING / FAIL counts + **Total readings**.
- **Body:** two columns — charts (H + V stacked) left; **Action items** ranked-worst-zones panel
  right (click-through to the filtered Data view).
- **Action items replaces the wide problem-zones table on the dashboard;** the full editable grid
  stays in the Data view.
- Amber used more assertively (header rules, active states, tile trims) but text stays legible
  (dark-on-amber, navy/foreground for body).
- Light + dark both maintained. Engines/backend/PlotlyChart/data-flow frozen. Version → 2.4.0.

---

## 1. Navy gradient header

- `AppShell`'s `<header>` (currently `bg-background/95 backdrop-blur`) becomes a Ford-navy
  gradient (e.g. `bg-gradient-to-r from-primary to-[hsl(211_59%_24%)]`) with light text.
- `AppTopbar` controls restyle for the dark band: brand text/sub light; the month/file `Select`
  triggers get a translucent-light treatment (readable on navy); Import = amber-accented primary,
  Standards = light outline; the Dashboard|Data switch reads on navy (active = light/amber). The
  `SidebarTrigger` + version label go light.
- A new CSS token pair if needed: `--header` / `--header-foreground` (navy / near-white) in
  `index.css`, mapped in `@theme inline`, so the header styling is token-driven (light + dark).

## 2. Hero metric strip — `frontend/src/components/StatStrip.tsx` (new)

- Replaces `AndonRibbon` as the headline row. Props `{ history, filters }` (same data inputs).
- Renders a responsive grid (`grid-cols-2 lg:grid-cols-4 gap-3`) of 4 tiles:
  - **PASS** (count of PASS groups) — emerald fill/trim.
  - **WARNING** (count) — amber.
  - **FAIL** (count) — red/destructive.
  - **Total readings** — neutral/navy; the count of records in the current selection.
- Each tile: large `font-mono` number, label, a status-colored left bar or tinted background, an
  icon (lucide). Counts come from the same `CFLogic.summarize` + `currentRecords` the ribbon used
  (port that logic; do not change it). PASS/WARNING/FAIL honor the orientation filter as today.
- `AndonRibbon.tsx` is removed from the dashboard (logic preserved in StatStrip). The per-group
  detail the old ribbon listed moves to the Action items panel (§3) where it belongs.

## 3. Two-column body (`App.tsx` dashboard branch)

- Below the strip: `grid grid-cols-1 xl:grid-cols-[2fr_1fr] gap-3`.
- **Left (charts):** the existing `ChartCards` (H + V), which already stack when the column is
  narrow. Unchanged except it now lives in the left column.
- **Right (Action items):** a new `frontend/src/components/ActionItems.tsx` — a compact ranked
  list built from `CFLogic.problemZones(recs, standards, N)` (same source as ProblemZones). Each
  item: status dot, color, position (H/V), Δ-below-min (mono), sorted worst-first. Clicking an
  item calls `onPick(color)` → App switches to the Data view filtered to that color (reuse the
  existing `dataFilter`/`setView` wiring). Empty state: "Every checkzone meets target."
- `ProblemZones.tsx` (the wide table) is **no longer rendered on the dashboard**. It is not
  deleted (kept for potential reuse + its test), but removed from `App.tsx`'s dashboard JSX. The
  full editable data remains in the Data view.

## 4. Bolder accent system

- Amber (`--accent`) used for: section header underlines/rules, active sidebar period-presets +
  chips (already amber), stat-tile trims where amber is the status, and the header's primary
  action. Dark-on-amber text only (legible).
- Status palette (emerald / amber / destructive) becomes consistent across StatStrip tiles and
  ActionItems dots — one visual language.
- Keep transitions 150–300ms, `prefers-reduced-motion` respected, the Plotly entrance animation.

## 5. Explicitly frozen

CFCore/CFLogic engines, backend + endpoints, `PlotlyChart.tsx`, the Data view (FilesPanel/
ReadingsGrid) + all editing, data flow, security posture. This is dashboard presentation +
composition only.

## 6. Accessibility

- Header: light text on the navy gradient must meet 4.5:1 (near-white on navy ≈ passes).
- Stat tiles: status conveyed by label + icon, not color alone; numbers high-contrast.
- ActionItems rows: keyboard-focusable buttons, visible focus ring, `cursor-pointer`.
- Light + dark verified per pair; reduced-motion honored.

## 7. Testing

- **Existing tests:** 15 CFLogic + 22 backend untouched and green. Frontend Vitest: the
  `AndonRibbon`/`ProblemZones` are no longer on the dashboard, but **ProblemZones.test stays valid**
  (component still exists). Add light tests for the new pieces where logic warrants:
  - `StatStrip` renders the 4 tiles with correct counts from a mocked summarize/records input.
  - `ActionItems` row click calls `onPick(color)` (mirror the ProblemZones onPick test).
  - These reuse the established mock-shared pattern. (If a new component is pure presentation with
    no branching, a render-smoke test is enough — no over-testing.)
- `tsc --noEmit` + `vite build` clean; CI stays green.
- Desktop build + manual smoke (user): the new header/strip/columns are unmistakable; all
  features + dark mode work.

## File structure

**New:** `frontend/src/components/StatStrip.tsx`, `frontend/src/components/ActionItems.tsx`,
their `.test.tsx` files.
**Modified:** `frontend/src/index.css` (header tokens), `frontend/src/components/shell/AppShell.tsx`
(gradient header), `AppTopbar.tsx` (on-navy restyle), `frontend/src/App.tsx` (dashboard branch:
strip + two-column body, drop AndonRibbon/ProblemZones from dashboard), `desktop/package.json`
(2.4.0).
**Unchanged:** `AndonRibbon.tsx` and `ProblemZones.tsx` remain in the tree (not rendered on the
dashboard); `ChartCards.tsx` moves into the left column with no internal change.

## Risks

- **Topbar-on-navy legibility:** the month/file `Select` + buttons must be readable on the navy
  gradient (their default styling assumes a light surface). Mitigation: explicit light/translucent
  variants for the header instance; verify contrast in the smoke test.
- **Two-column on small widths:** `xl:grid-cols-[2fr_1fr]` collapses to one column below `xl`;
  ensure charts + action list stack sensibly (mobile-first single column).
- **Dropping ProblemZones from the dashboard** changes a familiar surface — but the same data is in
  ActionItems (condensed) and the Data view (full). Intentional per the chosen direction.
- **Scope creep:** recomposition only; no new analytics or features. New analytics ideas go to a
  separate slice.
