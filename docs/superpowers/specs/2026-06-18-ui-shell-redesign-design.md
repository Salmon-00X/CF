# UI Shell Redesign — Design Spec (Slice 1)

**Date:** 2026-06-18
**Branch:** `redesign/v2`
**Status:** Approved design, pending spec review
**Milestone:** CF Wavescan Analyzer v2 redesign — Slice 1 of 2

---

## Context

CF Wavescan Analyzer shipped at 1.0.4 (on `main`) with a hand-rolled React + Plotly
dashboard. v2 redesigns the frontend onto `shadcn/ui` with a Ford Blue theme, deletes
legacy analysis features, and (in a later slice) adds in-app data management + editing.

This spec covers **Slice 1: the UI shell only.** Slice 2 (file delete + in-app row
editing) is a separate spec.

### Decisions locked (from brainstorming)

- **Branch:** all v2 work on `redesign/v2`. `main` keeps 1.0.4 intact and shippable —
  that is the "stored previous version." Legacy code is removed on the branch; git
  history preserves it.
- **Registry:** add the third-party `@efferd` shadcn registry. User explicitly owns the
  trust decision. Claude still **inspects the resolved registry JSON before installing**
  and discloses what components/dependencies each install pulls. No blind execution.
- **Template:** efferd `dashboard-7` (`https://efferd.com/view/dashboard-7`). Installable
  registry JSON resolves under `https://efferd.com/r/{style}/dashboard-7.json`.
- **Charts:** keep Plotly. Do not migrate to recharts this slice.
- **Auth:** none. Strip any login/auth from the template.

---

## 1. Stack & Architecture

- Initialize shadcn in `frontend/` — produces `components.json`, `new-york` style,
  Tailwind config, CSS-variable theming.
- Add `@efferd` registry to `components.json`.
- **Backend, SQLite, and the CFCore/CFLogic engines are unchanged.** This is a pure
  presentation swap — same data flow as `App.tsx` `loadAll()` over the existing API.
- No authentication anywhere.

## 2. Layout (dashboard-7 → app)

| Region | Content |
|--------|---------|
| **Sidebar** | Filters: model / plant / color / period. Replaces `Sidebar.tsx` + `FilterBar.tsx`. |
| **Topbar** | Month selector, file selector, Import button, Standards button, version label. Replaces `AppBar.tsx`. |
| **Main** | Status ribbon → KPI cards; ProblemZones → table; chart cards (status + Pareto). |

## 3. Component Map

| Old component | Action |
|---------------|--------|
| `AppBar.tsx` | → shadcn topbar |
| `Sidebar.tsx` | → shadcn sidebar |
| `FilterBar.tsx` | → fold into sidebar / filter chips |
| `DropZone.tsx` | keep, restyle inside a `Card` |
| `AndonRibbon.tsx` | → shadcn KPI `Card` row |
| `ProblemZones.tsx` | → shadcn `table` |
| `ChartCards.tsx` | keep Plotly, wrap each in shadcn `Card` |
| `PlotlyChart.tsx` | keep as-is (purge logic + Pareto-all-colors are regression-tested) |
| `ImportReviewDialog.tsx` | → shadcn `dialog` |
| `StandardsDialog.tsx` | → shadcn `dialog` |
| `TrendCard.tsx` | **DELETE** (month-over-month trend) |
| `DetailCard.tsx` | **DELETE** (checkzone detail + point-by-point comparison) |
| "Trend compare" / legacy toolbars | **DELETE** |

Keepers retain their existing props/data contracts where possible so the swap stays
mechanical and CFLogic calls are untouched.

## 4. Charts — Keep Plotly

Do **not** rewrite to recharts. Rationale: the Plotly `purge` signature logic (fixes the
"chart won't clear when month changes" bug) and the Pareto-all-colors + entrance
animation work just shipped in 1.0.4 and are regression-tested. Reuse `PlotlyChart.tsx`
verbatim, wrapped in a shadcn `Card`. Revisit recharts migration only if visual
consistency demands it (separate decision).

## 5. Theme — Ford Blue

- shadcn CSS variables. `--primary` = Ford Blue family (`#1F4E79`, already used by Pareto
  bars) so charts and chrome agree.
- Define light **and** dark token sets together; verify contrast independently per mode.
- Semantic tokens only in components — no per-component raw hex.

## 6. Verification

- `npm test` — 15 CFLogic tests stay green (engines untouched).
- `npm run build` (frontend) succeeds; no `require is not defined` / blank-screen
  regressions.
- Build + launch the desktop app: import an Excel file → status charts, Pareto, and
  problem zones render; no legacy trend/checkzone/comparison UI present.
- Visual/animation confirmation is the user's (cannot render headless).

## Out of Scope (Slice 2)

- File management (list + delete imported files).
- In-app viewing/editing/fixing of imported Excel rows, persisted to SQLite.

## Risks

- **Third-party registry (`@efferd`):** pulls external code. Mitigation: inspect resolved
  JSON before install; disclose every component + dependency added.
- **Template auth coupling:** dashboard-7 may ship login scaffolding. Mitigation: strip on
  import; verify no auth routes/guards remain.
- **Plotly + Tailwind interplay:** ensure Plotly container sizing works inside shadcn
  Card/flex layouts (responsive reflow).
