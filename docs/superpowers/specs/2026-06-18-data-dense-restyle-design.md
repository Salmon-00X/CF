# Data-Dense Restyle (ui-ux-pro-max + dashboard-4 direction) — Design Spec

**Date:** 2026-06-18
**Branch:** `feat/data-dense-restyle` (created at implementation)
**Status:** Approved design, pending spec review
**Milestone:** Post-v2.2.0 visual refresh

---

## Context

The app currently uses the shadcn shell shipped in v2.0.0 with Ford-Blue tokens. The user
wants the frontend converted to the ui-ux-pro-max **"Data-Dense Dashboard"** design system,
in the visual direction of efferd `dashboard-4` (a commerce/analytics dashboard: compact KPI
stat row, charts, a ranked action list). This is a **restyle + light recomposition** of the
existing components — not a rewrite. Data flow, CFLogic engines, the backend, and all features
stay exactly as they are.

`dashboard-4` itself is paywalled (only its public preview is viewable), so it is a *visual
reference*, not a code source. The concrete design contract comes from the ui-ux-pro-max
generator output (recorded below), adapted to the user's brand decision.

### Decisions locked (from brainstorming)

- **Style:** ui-ux-pro-max "Data-Dense Dashboard" — multiple widgets, KPI cards, minimal
  padding, grid layout, maximum data visibility.
- **Palette:** Ford navy `#1F4E79` stays **primary**; adopt amber `#D97706` as the **accent**
  (highlights), lighter surfaces (`background` ≈ `#F8FAFC`, `card` white), `destructive`
  `#DC2626`. (User chose "Ford Blue + amber accent".)
- **Typography:** **self-host** Fira Sans (UI) + Fira Code (tabular numerals) via
  `@fontsource/*` so vite bundles the woff2 — CSP `font-src 'self' data:` forbids remote CDNs.
- **Composition:** dashboard-4-style — compact KPI stat row, tighter 2-up charts grid,
  ProblemZones as the ranked action-items panel. Sidebar/topbar structurally unchanged,
  restyled to the denser scale.

---

## 1. Palette — `frontend/src/index.css` token edits

Update the existing `:root` / `.dark` token blocks (added in the v2 shell). Values in the
HSL channel form the tokens already use (`H S% L%`), consumed via `hsl(var(--x))`:

- `--background`: `#F8FAFC` → `210 40% 98%` (light); dark stays the existing deep navy.
- `--card`: white `0 0% 100%` (light) — keep.
- `--primary`: Ford navy `#1F4E79` → `211 59% 30%` — unchanged.
- **`--accent` / `--accent-foreground`:** amber `#D97706` → `32 95% 44%`, on-amber `0 0% 100%`.
  Amber is the *highlight* token (active filter chips, selected/hover row tint, badges) — NOT
  the primary action color (buttons stay navy). `--ring` stays navy.
- `--destructive`: `#DC2626` → `0 72% 51%` (light) — align to the recommendation.
- `--border`/`--muted`: nudge to the cooler `#DBEAFE`/`#E9EEF6` family for the data-dense feel.
- Dark mode: recompute the same roles (amber accent lightened for contrast); verify each pair
  meets 4.5:1 (body) / 3:1 (large) independently.

The Pareto/chart colors in `shared/src/logic.js` are **not** changed (engine code is frozen);
the chart legend swatches in `ChartCards.tsx` already reference fixed colors and stay.

## 2. Typography — self-hosted Fira

- Add deps: `@fontsource/fira-sans`, `@fontsource/fira-code` (woff2 + css; vite bundles them,
  served same-origin under `file://` like the other assets → CSP-safe).
- Import the needed weights in `frontend/src/main.tsx` (e.g. Fira Sans 400/500/600/700, Fira
  Code 400/500) — before `./index.css`.
- In `index.css` `@theme inline`, set `--font-sans: 'Fira Sans', system-ui, sans-serif;` and
  `--font-mono: 'Fira Code', ui-monospace, monospace;`, and apply `font-family: var(--font-sans)`
  to `body` in the base layer.
- Numeric/data cells (CF values, deltas, table figures, KPI counts) use `font-mono` +
  `tabular-nums` for aligned columns. Apply via a small utility class or the existing
  `tabular-nums` spots, switching them to mono.

## 3. Composition / density (component restyle)

No new components; tighten + restructure the existing ones:

- **`AndonRibbon` (KPI stat row):** convert the three PASS/WARNING/FAIL cards into compact stat
  tiles — big mono count, label, trend delta inline, the colored left-accent bar kept. Reduce
  padding; the row reads as the dashboard's headline stats.
- **`ChartCards`:** tighter 2-up grid, reduced card padding/heading size; Plotly unchanged.
- **`ProblemZones`:** denser table rows, amber row-hover tint (`hover:bg-accent/15`), keep the
  click-to-edit jump + cursor affordance. This is the "ranked action items" panel.
- **Global density:** reduce `AppShell` main padding/gaps (e.g. `p-4 md:p-5`, `gap-3`), card
  header sizes, and table cell padding so more data is visible without scrolling.
- **Sidebar / topbar:** structurally unchanged; restyle to the denser scale + amber active
  states (active filter chips/segments use the amber accent).

## 4. Effects

- Transitions 150–300ms on hover/active/filter changes (Tailwind `transition-colors`).
- Amber row-hover highlight on tables; keep Plotly hover tooltips and the chart entrance
  animation (`.plot-animate`).
- All motion under a `prefers-reduced-motion: reduce` guard (the existing guard stays; new
  transitions are color-only, which reduced-motion already tolerates).

## 5. Explicitly unchanged

CFCore/CFLogic engines, backend, `PlotlyChart.tsx`, the Data view grid behavior, all features,
the data flow, and the security posture. This is a presentation-only change.

## 6. Accessibility (recommendation checklist)

- Light + dark contrast verified per pair (amber-on-white and amber text especially — amber is
  low-contrast as text, so it is used for fills/borders/tints, with text staying navy/foreground).
- `cursor-pointer` on clickables, visible focus rings (navy), reduced-motion respected,
  responsive at 375/768/1024/1440.

## 7. Testing

- `npm test -w @cf-wavescan/shared` (15) + `npm test -w @cf-wavescan/backend` (22) stay green
  (no logic touched).
- `frontend` `tsc --noEmit` + `vite build` clean; verify the bundled Fira woff2 appear in
  `dist/assets` and no remote font request is emitted (CSP-safe).
- Desktop build + packaged launch; manual smoke (user): fonts render, amber highlights present,
  denser layout, all features work, dark mode legible.

## File structure

**Modified:** `frontend/src/index.css` (tokens + font vars + base font-family),
`frontend/src/main.tsx` (font imports), `frontend/package.json` (fontsource deps),
`frontend/src/components/AndonRibbon.tsx`, `ChartCards.tsx`, `ProblemZones.tsx`,
`components/shell/AppShell.tsx`, `AppSidebar.tsx`, `AppTopbar.tsx`, and the Data view
components (`FilesPanel.tsx`, `ReadingsGrid.tsx`) for density + mono numerals.
**New:** none (fonts come from npm packages).

## Risks

- **Amber as text fails contrast:** amber `#D97706` on white is ~3:1 (OK for large/icons, not
  body). Mitigation: amber only for fills/borders/tints/large numerals; body + small text stay
  foreground/navy. Verified in the contrast pass.
- **Packaged-app font loading under `file://`:** bundled woff2 must resolve via the relative
  `base: './'` asset paths (same mechanism as JS/CSS today). Mitigation: verify in the packaged
  smoke that glyphs render (Fira, not fallback).
- **Density vs touch targets:** tightening padding must keep interactive targets usable;
  buttons/rows stay ≥ comfortable click size (this is a desktop app, not touch-first, but keep
  reasonable hit areas).
- **Scope creep:** this is a restyle. No feature/logic changes; if a "while we're here" idea
  appears, it goes to a separate slice.
