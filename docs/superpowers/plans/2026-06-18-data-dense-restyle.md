# Data-Dense Restyle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the existing shadcn frontend to the ui-ux-pro-max "Data-Dense Dashboard" look (Ford-navy + amber accent, self-hosted Fira type, tighter grid), presentation-only.

**Architecture:** Token edits in `index.css` + self-hosted Fira via `@fontsource`, then concrete Tailwind class changes across the existing components for density, amber highlights, and mono numerals. No new components, no logic/data/engine/backend changes.

**Tech Stack:** React 18 + Tailwind v4 + shadcn, `@fontsource/fira-sans` + `@fontsource/fira-code`, Plotly, Electron 33.

## Global Constraints

- **Branch:** `feat/data-dense-restyle`.
- **Presentation only:** no edits to `shared/`, `backend/`, `PlotlyChart.tsx`, data flow, or any feature logic. CFLogic/CFCore frozen.
- **Palette:** primary stays Ford navy `#1F4E79` (`211 59% 30%`); **amber `#D97706` (`32 95% 44%`) is the ACCENT/highlight only** — buttons, focus `--ring`, primary actions stay navy. Surfaces lighten (`--background` `210 40% 98%`). `--destructive` `0 72% 51%`.
- **Amber never as small/body text** (≈3:1 on white) — amber only for fills/borders/tints/large numerals; text stays foreground/navy.
- **Fonts self-hosted** via `@fontsource` (vite bundles woff2, served same-origin → CSP `font-src 'self' data:` safe). NO remote font CDN / `<link>`/`@import` to googleapis.
- **Regression gate:** 15 CFLogic + 22 backend tests stay green; frontend `tsc --noEmit` + `vite build` clean; bundled Fira woff2 present in `dist/assets`, no remote font request.
- **Dark mode** updated in lockstep; contrast verified per pair.

---

## File Structure

**Modified:**
- `frontend/package.json` — add fontsource deps
- `frontend/src/main.tsx` — import Fira weights
- `frontend/src/index.css` — palette tokens, `--font-sans`/`--font-mono`, base body font
- `frontend/src/components/AndonRibbon.tsx` — compact KPI stat tiles, mono counts
- `frontend/src/components/ChartCards.tsx` — tighter cards
- `frontend/src/components/ProblemZones.tsx` — denser rows, amber hover, mono numerals
- `frontend/src/components/shell/AppShell.tsx` — tighter main padding/gaps
- `frontend/src/components/shell/AppSidebar.tsx`, `AppTopbar.tsx` — amber active states, denser
- `frontend/src/components/data/FilesPanel.tsx`, `ReadingsGrid.tsx` — density, amber hover, mono numerals
- `desktop/package.json` — version bump (Task 4)

**Testing note:** this is a visual change with no testable logic; per-task verification is `tsc` + `vite build` clean + the existing 37 tests staying green. Visual confirmation is the user's (can't render headless).

---

### Task 1: Palette tokens + self-hosted Fira fonts (foundation)

**Files:** Modify `frontend/package.json`, `frontend/src/main.tsx`, `frontend/src/index.css`.

**Interfaces:**
- Produces: amber `--accent`, lightened surfaces, `--font-sans`/`--font-mono` theme vars, and a base `body` font-family — consumed by every later task's `font-mono`/`bg-accent`/`text-foreground` classes.

- [ ] **Step 1: Add fontsource deps**

```bash
npm -w @cf-wavescan/frontend i @fontsource/fira-sans @fontsource/fira-code
```

- [ ] **Step 2: Import Fira weights in `frontend/src/main.tsx`** (before `./index.css`)

Add these imports above `import './index.css';`:
```ts
import '@fontsource/fira-sans/400.css';
import '@fontsource/fira-sans/500.css';
import '@fontsource/fira-sans/600.css';
import '@fontsource/fira-sans/700.css';
import '@fontsource/fira-code/400.css';
import '@fontsource/fira-code/500.css';
```

- [ ] **Step 3: Edit light-mode tokens in `frontend/src/index.css` `:root`**

Change these lines (leave all others as-is):
```css
    --background: 210 40% 98%;
    --accent: 32 95% 44%;
    --accent-foreground: 0 0% 100%;
    --destructive: 0 72% 51%;
    --border: 214 32% 88%;
    --input: 214 32% 88%;
    --muted: 214 30% 95%;
```

- [ ] **Step 4: Edit dark-mode tokens in `.dark`** (amber lightened for dark surfaces)

```css
    --accent: 32 90% 55%;
    --accent-foreground: 213 40% 10%;
    --destructive: 0 72% 55%;
```

- [ ] **Step 5: Add font theme vars + base body font**

In the `@theme inline` block, add (next to the color vars):
```css
  --font-sans: 'Fira Sans', system-ui, -apple-system, sans-serif;
  --font-mono: 'Fira Code', ui-monospace, SFMono-Regular, monospace;
```
In `@layer base`, after the `.dark { … }` block, add:
```css
  body {
    font-family: var(--font-sans);
  }
```

- [ ] **Step 6: Verify** — `npm run build -w @cf-wavescan/frontend` succeeds; confirm Fira woff2 bundled and no remote font URL:
```bash
ls frontend/dist/assets | grep -iE "fira" | head
grep -riE "fonts.googleapis|fonts.gstatic" frontend/dist/assets/*.css && echo "REMOTE FONT LEAK" || echo "no remote font refs"
```
Expected: woff2 files listed; `no remote font refs`. Then `cd frontend && npx tsc --noEmit` → exit 0.

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json package-lock.json frontend/src/main.tsx frontend/src/index.css
git commit -m "feat(frontend): data-dense palette tokens (amber accent) + self-hosted Fira fonts"
```

---

### Task 2: KPI stat row + global density

**Files:** Modify `frontend/src/components/AndonRibbon.tsx`, `frontend/src/components/shell/AppShell.tsx`.

**Interfaces:** Consumes `--font-mono`, `--accent` from Task 1. No exported interface change.

- [ ] **Step 1: `AppShell.tsx` — tighten main spacing**

Change the `<main>` className from `flex flex-1 flex-col gap-4 p-4 md:p-6` to:
```tsx
        <main className="flex flex-1 flex-col gap-3 p-3 md:p-5">{children}</main>
```

- [ ] **Step 2: `AndonRibbon.tsx` — compact stat tiles + mono counts**

- Grid: change `grid grid-cols-1 gap-4 md:grid-cols-3` → `grid grid-cols-1 gap-3 md:grid-cols-3`.
- `CardHeader` className `flex-row items-baseline gap-2 py-3` → `flex-row items-baseline gap-2 py-2`.
- The count span className `text-3xl font-bold tabular-nums` → `font-mono text-3xl font-bold tabular-nums`.
- `CardContent` className `space-y-2 pt-0 text-sm` → `space-y-1.5 pt-0 text-sm`.
- The per-group numeric line (`avg {fmtCF}/Ford…`) span: add `font-mono` to its className (currently `w-full text-[11px] tabular-nums text-muted-foreground` → `w-full font-mono text-[11px] tabular-nums text-muted-foreground`).

- [ ] **Step 3: Verify** — `cd frontend && npx tsc --noEmit` exit 0; `npm run build -w @cf-wavescan/frontend` succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/AndonRibbon.tsx frontend/src/components/shell/AppShell.tsx
git commit -m "feat(frontend): compact KPI stat row + tighter shell density"
```

---

### Task 3: Charts + ProblemZones density, amber hover, mono numerals

**Files:** Modify `frontend/src/components/ChartCards.tsx`, `frontend/src/components/ProblemZones.tsx`.

- [ ] **Step 1: `ChartCards.tsx` — tighter grid + headers**

- Section grid `grid grid-cols-1 gap-4 xl:grid-cols-2` → `grid grid-cols-1 gap-3 xl:grid-cols-2`.
- `CardHeader` `flex-row items-center justify-between gap-3 pb-2` → keep but add `py-2`: `flex-row items-center justify-between gap-3 py-2`.
- Leave `PlotlyChart` and the `h-[360px]` container unchanged.

- [ ] **Step 2: `ProblemZones.tsx` — denser rows, amber hover, mono numerals**

- The `TableRow` for data rows (currently `key={i}`): add an amber hover tint class:
  `<TableRow key={i} className="hover:bg-accent/15">`.
- Numeric cells — add `font-mono` to the CF / Δ Ford / Δ Min cells. The CF cell `className="text-right tabular-nums"` → `text-right font-mono tabular-nums`; the two dev cells `cn('text-right tabular-nums', devClass(...))` → `cn('text-right font-mono tabular-nums', devClass(...))`; the zone cell `className="tabular-nums"` → `font-mono tabular-nums`.
- Tighten: on the `<Table>` wrapper add compact cell padding via a className on each `TableCell`? Instead, set the container — leave shadcn defaults (already compact). No structural change.

- [ ] **Step 3: Verify** — `cd frontend && npx tsc --noEmit` exit 0; `npm run build -w @cf-wavescan/frontend` succeeds.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ChartCards.tsx frontend/src/components/ProblemZones.tsx
git commit -m "feat(frontend): denser charts + problem-zones with amber hover + mono numerals"
```

---

### Task 4: Chrome + Data view density / amber states, then verify + build

**Files:** Modify `frontend/src/components/shell/AppSidebar.tsx`, `AppTopbar.tsx`, `frontend/src/components/data/FilesPanel.tsx`, `ReadingsGrid.tsx`, `desktop/package.json`.

- [ ] **Step 1: `AppSidebar.tsx` — amber active states**

- The period-preset active button class: change the active branch from `border-primary bg-primary text-primary-foreground` to `border-accent bg-accent text-accent-foreground` (amber for the *selected period preset*). Leave the inactive branch.
- The `Seg` active branch (`value === o.v ? 'bg-primary text-primary-foreground' …`): leave navy (segmented model/position/chart are primary controls). Only the period presets + chips go amber.
- The `Chip` "on" branch (`border-primary bg-primary text-primary-foreground`) → `border-accent bg-accent text-accent-foreground` (amber selected plant/color chips).

- [ ] **Step 2: `AppTopbar.tsx` — denser + amber view switch active (optional accent)**

- Leave the Dashboard/Data switch active state navy (it is primary nav) — no change required. Density is already tight (`h-14` bar). No change unless tsc/build complains. (This step is intentionally minimal; the topbar is already compact.)

- [ ] **Step 3: `ReadingsGrid.tsx` + `FilesPanel.tsx` — mono numerals + amber row hover**

- `ReadingsGrid` table data `TableRow`: add `className="hover:bg-accent/10"`.
- The CF display in the `Cell` (the `field === 'cf'` display path renders `CFCore.fmtCF`): wrap numeric display cells with `font-mono` — on the CF `<TableCell className="p-1 text-right tabular-nums">` add `font-mono` → `p-1 text-right font-mono tabular-nums`.
- `FilesPanel`: the `Rows` count cell `className="text-right tabular-nums"` → `text-right font-mono tabular-nums`; data `TableRow` add `className="hover:bg-accent/10"`.

- [ ] **Step 4: Bump version** `2.2.0` → `2.3.0` in `desktop/package.json`.

- [ ] **Step 5: Full verify**

```bash
npm test -w @cf-wavescan/shared      # 15 pass
npm test -w @cf-wavescan/backend     # 22 pass
cd frontend && npx tsc --noEmit && cd ..   # exit 0
npm run build -w @cf-wavescan/frontend     # clean
```

- [ ] **Step 6: Desktop installer + packaged smoke**

```bash
npm run dist:win -w @cf-wavescan/desktop   # -> Setup 2.3.0.exe
```
Then packaged backend health smoke (Electron `ELECTRON_RUN_AS_NODE=1` + temp DB/PORT → `/api/months` 200, 127.0.0.1). Confirm `dist/assets` still contains the Fira woff2 (fonts shipped).

- [ ] **Step 7: Manual smoke (user)** — fonts are Fira (not system), amber highlights on selected chips / hovered rows, denser layout, all features + dark mode legible.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/shell/AppSidebar.tsx frontend/src/components/shell/AppTopbar.tsx frontend/src/components/data/FilesPanel.tsx frontend/src/components/data/ReadingsGrid.tsx desktop/package.json
git commit -m "feat(frontend): amber active states + data-view density; bump desktop 2.3.0"
```

---

## Self-Review

**Spec coverage:** palette tokens incl. amber accent + light surfaces + destructive (T1 S3–S4); self-hosted Fira, CSP-safe, no remote (T1 S2/S6); font vars + body font (T1 S5); KPI stat row density + mono counts (T2); charts + problem-zones density/amber-hover/mono (T3); sidebar amber active chips/presets, data-view density + mono + amber hover (T4); dark-mode tokens (T1 S4); verify incl. font-bundling + 37 tests + 2.3.0 build (T1 S6, T4 S5–S6). All spec sections mapped. Amber-as-text avoided (amber only on fills `bg-accent`, borders `border-accent`, large mono counts — never small body text).

**Placeholder scan:** Task 1 is fully literal (exact token values, exact imports, exact verify commands). Tasks 2–4 cite the exact current class strings and their replacements — concrete, not vague. No "polish it"/TBD steps. (T4 S2 is intentionally a no-op-unless-needed and says so.)

**Type consistency:** no signatures change (presentation only) — `--font-sans`/`--font-mono`/`--accent` defined in T1 and consumed by class names (`font-mono`, `bg-accent`, `border-accent`, `text-accent-foreground`) in T2–T4; Tailwind v4 maps these from the `@theme inline` vars. `PlotlyChart`, props, and data flow untouched.
