# UI Shell Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled React/Plotly frontend with a shadcn/ui + Ford Blue dashboard (efferd `dashboard-7`), porting the keeper features and deleting the legacy trend/checkzone/comparison UI — backend and analysis engines untouched.

**Architecture:** Pure presentation swap. The Express+SQLite backend, the CFCore/CFLogic engines, and `App.tsx`'s data flow (`loadAll()` over the existing API) stay intact. We add Tailwind v4 + shadcn, theme it Ford Blue, rebuild the chrome (sidebar/topbar) and the content cards on shadcn primitives, keep Plotly for charts, and remove the deleted features last so the build never breaks mid-flight.

**Tech Stack:** React 18, Vite 5, TypeScript 5, Tailwind v4 (`@tailwindcss/vite`), shadcn/ui (`new-york`), `@efferd` registry (dashboard-7), Plotly (`plotly.js-dist-min`), Electron 33 packaging.

## Global Constraints

_Every task implicitly includes these. Exact values, copied from the spec + verified infra._

- **Branch:** all work on `redesign/v2`. Never touch `main` (holds shippable 1.0.4 = stored previous version).
- **Preserve `vite.config.ts` semantics:** keep `base: './'`, the `/api` → `http://127.0.0.1:4000` dev proxy, `optimizeDeps.include` of the two shared engines, and `build.commonjsOptions.transformMixedEsModules` + its `include` regex. Losing these reintroduces the `require is not defined` blank screen.
- **Backend / SQLite / CFCore / CFLogic:** unchanged. No edits under `backend/`, `shared/`.
- **No authentication** anywhere. Strip any login/guard the template ships.
- **`@efferd` registry:** resolve the registry JSON and inspect it (components + dependencies it pulls) BEFORE running any `add`. Disclose findings. No blind execution.
- **Fonts:** packaged CSP is `font-src 'self' data:` — no remote font CDNs. Self-host any template font or fall back to a system stack.
- **Theme:** `--primary` = Ford Blue family, anchored on `#1F4E79` (the existing Pareto bar color) so chrome and charts agree. Light + dark token sets both defined.
- **Charts:** keep Plotly. Do NOT migrate to recharts. Reuse `frontend/src/components/PlotlyChart.tsx` verbatim.
- **Regression gate:** `npm test -w @cf-wavescan/shared` keeps all 15 CFLogic tests green at every commit.
- **Deletions:** `TrendCard.tsx`, `DetailCard.tsx`, and any "Trend compare" toolbar are removed in Task 13 (last), after all consumers are gone, so the build stays green.

---

## File Structure

**New:**
- `frontend/components.json` — shadcn config (+ `@efferd` registry)
- `frontend/tailwind` wiring: `frontend/src/index.css` (Tailwind + Ford Blue tokens)
- `frontend/src/components/ui/*` — shadcn-generated primitives (button, card, dialog, table, select, sidebar, input, sonner)
- `frontend/src/components/shell/AppSidebar.tsx` — filter sidebar (replaces `Sidebar.tsx` + `FilterBar.tsx`)
- `frontend/src/components/shell/AppTopbar.tsx` — month/file/import/standards/version (replaces `AppBar.tsx`)
- `frontend/src/lib/utils.ts` — shadcn `cn()` helper

**Modified:**
- `frontend/package.json` — add tailwind/shadcn deps
- `frontend/vite.config.ts` — add `@tailwindcss/vite` + `@` alias (preserve all existing keys)
- `frontend/tsconfig.json` — `@/*` path alias
- `frontend/src/main.tsx` — import `./index.css`, mount `<Toaster/>`
- `frontend/src/App.tsx` — new shell layout, remove deleted features
- `frontend/src/components/{DropZone,AndonRibbon,ProblemZones,ChartCards,ImportReviewDialog,StandardsDialog}.tsx` — reskin to shadcn, props/logic preserved

**Deleted:**
- `frontend/src/components/TrendCard.tsx`
- `frontend/src/components/DetailCard.tsx`
- `frontend/src/styles/app.css` (after its rules are superseded by Tailwind/tokens; remove the import)
- legacy "Trend compare" toolbar markup (lives in `FilterBar.tsx`/`Sidebar.tsx` — confirm during port)

**Testing note:** the analysis logic is in CFLogic (untouched, already covered by 15 unit tests). The shell has no new unit-testable logic, so per-task verification is: shared tests stay green + `vite build` succeeds + targeted smoke checks. New pure functions, if any are introduced, get a unit test before use.

---

### Task 1: Tailwind + shadcn baseline (no visual change yet)

**Files:**
- Modify: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`
- Create: `frontend/src/index.css`, `frontend/src/lib/utils.ts`, `frontend/components.json`

**Interfaces:**
- Produces: `@` path alias → `frontend/src`; `cn()` from `@/lib/utils`; Tailwind active via `src/index.css`.

- [ ] **Step 1: Install Tailwind v4 + tooling**

Run:
```bash
npm -w @cf-wavescan/frontend i -D tailwindcss @tailwindcss/vite
npm -w @cf-wavescan/frontend i clsx tailwind-merge class-variance-authority lucide-react
```

- [ ] **Step 2: Replace `vite.config.ts` (preserve every existing key)**

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: './',
  resolve: { alias: { '@': path.resolve(__dirname, './src') } },
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:4000' } },
  optimizeDeps: { include: ['@cf-wavescan/shared/src/core.js', '@cf-wavescan/shared/src/logic.js'] },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/shared[\\/]src[\\/].*\.js$/, /node_modules/],
    },
  },
});
```

- [ ] **Step 3: Add `@/*` alias to `frontend/tsconfig.json`**

In `compilerOptions` add (create the keys if absent):
```json
"baseUrl": ".",
"paths": { "@/*": ["./src/*"] }
```

- [ ] **Step 4: Create `frontend/src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 5: Create `frontend/src/index.css` (Tailwind import + placeholder layer; tokens land in Task 3)**

```css
@import 'tailwindcss';
```

- [ ] **Step 6: Create `frontend/components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 7: Import the stylesheet in `main.tsx`**

Change the css import line so both load (Tailwind first, legacy second so legacy still wins until removed in Task 13):
```ts
import './index.css';
import './styles/app.css';
```

- [ ] **Step 8: Verify build + tests**

Run:
```bash
npm test -w @cf-wavescan/shared
npm run build -w @cf-wavescan/frontend
```
Expected: 15 tests PASS; build succeeds; no `require is not defined`.

- [ ] **Step 9: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts frontend/tsconfig.json frontend/src/index.css frontend/src/lib/utils.ts frontend/components.json frontend/src/main.tsx
git commit -m "build(frontend): add tailwind v4 + shadcn baseline (no UI change)"
```

---

### Task 2: Resolve + inspect the `@efferd` registry (gate before any pull)

**Files:**
- Modify: `frontend/components.json`
- Create: `docs/superpowers/notes/efferd-dashboard-7-inspection.md`

**Interfaces:**
- Produces: a vetted `@efferd` registry entry + a written record of what `dashboard-7` installs.

- [ ] **Step 1: Resolve the registry JSON**

Template preview: `https://efferd.com/view/dashboard-7`. Registry items resolve under `https://efferd.com/r/`. Fetch the item JSON (try, in order, until one returns valid shadcn-registry JSON):
```bash
curl -fsSL https://efferd.com/r/dashboard-7.json -o /tmp/efferd-d7.json || \
curl -fsSL https://efferd.com/r/new-york/dashboard-7.json -o /tmp/efferd-d7.json || \
curl -fsSL https://efferd.com/r/styles/new-york/dashboard-7.json -o /tmp/efferd-d7.json
```

- [ ] **Step 2: Inspect what it pulls — write it down**

Read the JSON. Record in `docs/superpowers/notes/efferd-dashboard-7-inspection.md`:
- `registryDependencies` (other shadcn components it needs)
- `dependencies` (npm packages — flag anything unexpected: network clients, analytics, auth libs)
- `files[].path` (every file it will write) and a one-line purpose each
- any auth/login files (these get stripped in Task 5)
- any remote font `@import`/`<link>` (must be self-hosted per CSP)

If the JSON pulls anything beyond UI (telemetry, outbound HTTP, auth backends), STOP and surface to the user before continuing.

- [ ] **Step 3: Add the registry to `components.json`**

Add a top-level `registries` block (exact value the user supplied):
```json
"registries": {
  "@efferd": "https://efferd.com/r/{style}/{name}.json"
}
```
If Step 1 proved a different resolvable shape (e.g. no `{style}` segment), use the shape that actually returned valid JSON and note the correction in the inspection file.

- [ ] **Step 4: Commit (config + notes only, no component code yet)**

```bash
git add frontend/components.json docs/superpowers/notes/efferd-dashboard-7-inspection.md
git commit -m "chore(frontend): register @efferd registry + record dashboard-7 inspection"
```

---

### Task 3: Ford Blue theme tokens

**Files:**
- Modify: `frontend/src/index.css`

**Interfaces:**
- Produces: shadcn CSS-variable tokens (`--primary`, `--background`, etc.) for light + dark, anchored on Ford Blue.

- [ ] **Step 1: Append the token layer to `src/index.css`**

```css
@import 'tailwindcss';

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 213 40% 12%;
    --card: 0 0% 100%;
    --card-foreground: 213 40% 12%;
    --popover: 0 0% 100%;
    --popover-foreground: 213 40% 12%;
    /* Ford Blue #1F4E79 -> hsl(211 59% 30%) */
    --primary: 211 59% 30%;
    --primary-foreground: 0 0% 100%;
    --secondary: 211 30% 95%;
    --secondary-foreground: 211 59% 25%;
    --muted: 213 20% 96%;
    --muted-foreground: 213 12% 42%;
    --accent: 211 40% 92%;
    --accent-foreground: 211 59% 25%;
    --destructive: 0 72% 46%;
    --destructive-foreground: 0 0% 100%;
    --border: 213 18% 88%;
    --input: 213 18% 88%;
    --ring: 211 59% 30%;
    --radius: 0.6rem;
  }
  .dark {
    --background: 213 40% 8%;
    --foreground: 213 20% 94%;
    --card: 213 38% 11%;
    --card-foreground: 213 20% 94%;
    --popover: 213 38% 11%;
    --popover-foreground: 213 20% 94%;
    --primary: 211 70% 62%;
    --primary-foreground: 213 40% 10%;
    --secondary: 213 30% 18%;
    --secondary-foreground: 213 20% 94%;
    --muted: 213 28% 16%;
    --muted-foreground: 213 14% 64%;
    --accent: 213 30% 20%;
    --accent-foreground: 213 20% 94%;
    --destructive: 0 62% 52%;
    --destructive-foreground: 0 0% 100%;
    --border: 213 28% 22%;
    --input: 213 28% 22%;
    --ring: 211 70% 62%;
  }
}

@theme inline {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));
  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));
  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));
  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));
  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));
  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));
  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));
  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));
  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));
  --radius-lg: var(--radius);
  --radius-md: calc(var(--radius) - 2px);
  --radius-sm: calc(var(--radius) - 4px);
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build -w @cf-wavescan/frontend`
Expected: build succeeds.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/index.css
git commit -m "feat(frontend): Ford Blue theme tokens (light + dark)"
```

---

### Task 4: Add base shadcn primitives

**Files:**
- Create: `frontend/src/components/ui/{button,card,dialog,table,select,input,sidebar,sonner,separator,badge,scroll-area}.tsx`

**Interfaces:**
- Produces: importable primitives, e.g. `import { Card, CardHeader, CardContent } from '@/components/ui/card'`.

- [ ] **Step 1: Add primitives via shadcn CLI**

Run:
```bash
cd frontend
npx shadcn@latest add button card dialog table select input sidebar sonner separator badge scroll-area --yes
```

- [ ] **Step 2: Verify they reference the tokens, build passes**

Run: `npm run build -w @cf-wavescan/frontend`
Expected: build succeeds; generated files import `cn` from `@/lib/utils`.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ui frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): add base shadcn primitives"
```

---

### Task 5: App shell layout (sidebar + topbar frame), auth stripped

**Files:**
- Create: `frontend/src/components/shell/AppShell.tsx`
- Modify: `frontend/src/App.tsx`

**Interfaces:**
- Consumes: `SidebarProvider`, `Sidebar`, `SidebarInset` from `@/components/ui/sidebar`.
- Produces: `<AppShell topbar={...} sidebar={...}>{main}</AppShell>` — a layout frame with no app logic.

- [ ] **Step 1: Pull dashboard-7 (only after Task 2 inspection passed)**

Run:
```bash
cd frontend
npx shadcn@latest add @efferd/dashboard-7 --yes
```
Then DELETE any auth/login files the inspection flagged, and remove any remote-font `<link>`/`@import` (self-host or drop to system stack).

- [ ] **Step 2: Create `AppShell.tsx` (layout only — no data, no auth)**

```tsx
import { SidebarProvider, Sidebar, SidebarInset } from '@/components/ui/sidebar';

interface Props {
  sidebar: React.ReactNode;
  topbar: React.ReactNode;
  children: React.ReactNode;
}

export default function AppShell({ sidebar, topbar, children }: Props) {
  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">{sidebar}</Sidebar>
      <SidebarInset>
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background px-4">
          {topbar}
        </header>
        <main className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
```

- [ ] **Step 3: Wrap existing content in `App.tsx` with `AppShell`**

Keep ALL existing state/handlers in `App.tsx`. Replace only the returned JSX wrapper: the old `<AppBar/>` + `<div className="shell">` becomes `<AppShell topbar={<AppTopbar .../>} sidebar={<AppSidebar .../>}>`. For this task, pass placeholders for topbar/sidebar (`<div/>`), keep the existing `<main>` children (`FilterBar`, `DropZone`, `AndonRibbon`, `ProblemZones`, `ChartCards`, and — for now — `TrendCard`/`DetailCard`). They are restyled/removed in later tasks.

- [ ] **Step 4: Verify build + tests**

Run:
```bash
npm test -w @cf-wavescan/shared
npm run build -w @cf-wavescan/frontend
```
Expected: 15 PASS; build succeeds. Confirm no auth route/guard remains: `grep -ri "login\|signin\|auth" frontend/src` returns only unrelated matches.

- [ ] **Step 5: Commit**

```bash
git add frontend/src frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): shadcn app shell (sidebar+topbar), auth stripped"
```

---

### Task 6: Port topbar (AppBar → AppTopbar)

**Files:**
- Create: `frontend/src/components/shell/AppTopbar.tsx`
- Modify: `frontend/src/App.tsx` (use real topbar), later delete `AppBar.tsx` in Task 13
- Reference: read `frontend/src/components/AppBar.tsx` for the exact props/handlers to preserve

**Interfaces:**
- Consumes (props, mirror current `AppBar` usage in `App.tsx:180-194`): `months`, `monthKey`, `onMonthChange`, `files`, `fileSel`, `onFileChange`, `fileSelDisabled`, `fileSelLabel`, `version`, `onImport`, `onStandards`, `hasData`.
- Produces: `AppTopbar` with identical behavior, built on `@/components/ui/select` + `@/components/ui/button` + `SidebarTrigger`.

- [ ] **Step 1: Build `AppTopbar.tsx`**

Use `SidebarTrigger` (hamburger), a `Select` for month (options from `months`, value `monthKey`, onChange `onMonthChange`), a `Select` for file (disabled per `fileSelDisabled`, label `fileSelLabel`), `Button` "Import" → `onImport`, `Button variant="outline"` "Standards" → `onStandards`, and a muted `v{version}` label. Preserve the exact data shapes used by `AppBar.tsx` (read it first).

- [ ] **Step 2: Wire it in `App.tsx`** — replace the placeholder topbar with `<AppTopbar ...sameProps/>`.

- [ ] **Step 3: Verify** — `npm run build -w @cf-wavescan/frontend` succeeds; month/file selects and Import/Standards buttons present.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shell/AppTopbar.tsx frontend/src/App.tsx
git commit -m "feat(frontend): port topbar to shadcn (AppTopbar)"
```

---

### Task 7: Port filter sidebar (Sidebar + FilterBar → AppSidebar)

**Files:**
- Create: `frontend/src/components/shell/AppSidebar.tsx`
- Modify: `frontend/src/App.tsx`
- Reference: `frontend/src/components/Sidebar.tsx`, `frontend/src/components/FilterBar.tsx`

**Interfaces:**
- Consumes (mirror current `Sidebar` usage `App.tsx:197-204`): `history`, `filters`, `update`, `onReset`.
- Produces: `AppSidebar` rendering model/plant/color/period filters via `@/components/ui/select` + `@/components/ui/sidebar` groups; "Reset" `Button` → `onReset`.

- [ ] **Step 1:** Read `Sidebar.tsx` + `FilterBar.tsx`; reproduce their filter controls and the `useFilters` `update(...)` calls inside `SidebarContent`/`SidebarGroup`. Drop any "Trend compare" control found here (it is being deleted).
- [ ] **Step 2:** Replace placeholder sidebar in `App.tsx` with `<AppSidebar .../>`. Remove the now-unused `FilterBar` from `<main>` (its filters live in the sidebar now) OR keep an active-filter chip row — choose based on `FilterBar.tsx` content; document the choice in the commit.
- [ ] **Step 3: Verify** — `npm test -w @cf-wavescan/shared` (15 PASS) + `npm run build -w @cf-wavescan/frontend`.
- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/shell/AppSidebar.tsx frontend/src/App.tsx
git commit -m "feat(frontend): port filters to shadcn sidebar (AppSidebar)"
```

---

### Task 8: Reskin DropZone inside a Card

**Files:** Modify `frontend/src/components/DropZone.tsx`

**Interfaces:** Consumes existing props `hasData`, `onFile`. Keep the hidden `<input type="file" className="...">` and the `.drop input[type=file]` selector hook used by `App.tsx:190` (Import button clicks it) — DO NOT rename that hook.

- [ ] **Step 1:** Wrap the dropzone in `Card`/`CardContent`; restyle the drag target with Tailwind. Preserve drag handlers and the file input + its class selector.
- [ ] **Step 2: Verify** — `npm run build -w @cf-wavescan/frontend`; Import button still triggers the picker.
- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/DropZone.tsx
git commit -m "feat(frontend): reskin DropZone as shadcn Card"
```

---

### Task 9: AndonRibbon → KPI cards

**Files:** Modify `frontend/src/components/AndonRibbon.tsx`

**Interfaces:** Consumes existing props `history`, `filters`. Keep all CFLogic calls; change only markup to a responsive grid of `Card`s (PASS/WARNING/FAIL counts), using `--primary` for emphasis and `--destructive` for fails.

- [ ] **Step 1:** Read the file; wrap each metric in a `Card` with `CardHeader`/`CardContent`; grid `grid-cols-2 md:grid-cols-4 gap-4`.
- [ ] **Step 2: Verify** — `npm run build -w @cf-wavescan/frontend`.
- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/AndonRibbon.tsx
git commit -m "feat(frontend): AndonRibbon as shadcn KPI cards"
```

---

### Task 10: ProblemZones → shadcn Table

**Files:** Modify `frontend/src/components/ProblemZones.tsx`

**Interfaces:** Consumes existing props `history`, `filters`, `onPickColor`. Preserve the row → `onPickColor(color)` interaction (used to drive detail today; after Task 13 it may be a no-op or feed a future slice — keep the prop, keep clickable rows).

- [ ] **Step 1:** Replace table markup with `Table`/`TableHeader`/`TableRow`/`TableCell` from `@/components/ui/table`; keep sorting/data logic.
- [ ] **Step 2: Verify** — `npm run build -w @cf-wavescan/frontend`.
- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ProblemZones.tsx
git commit -m "feat(frontend): ProblemZones as shadcn Table"
```

---

### Task 11: Wrap charts in Card (Plotly unchanged)

**Files:** Modify `frontend/src/components/ChartCards.tsx`. DO NOT modify `PlotlyChart.tsx`.

**Interfaces:** Consumes existing props `history`, `filters`. Keep every `PlotlyChart` usage and its `plot`/`orient` props exactly (the purge signature + Pareto-all-colors logic depend on them).

- [ ] **Step 1:** Wrap each chart in `Card`+`CardHeader`(title)+`CardContent`. Ensure the Plotly container keeps a real height (e.g. `className="h-[360px]"` on the chart div wrapper) so responsive reflow works inside flex/grid.
- [ ] **Step 2: Verify** — `npm run build -w @cf-wavescan/frontend`. Smoke: status chart + Pareto still render after a month change (manual, in dev).
- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ChartCards.tsx
git commit -m "feat(frontend): chart cards on shadcn (Plotly intact)"
```

---

### Task 12: Dialogs → shadcn Dialog

**Files:** Modify `frontend/src/components/ImportReviewDialog.tsx`, `frontend/src/components/StandardsDialog.tsx`

**Interfaces:**
- `ImportReviewDialog`: props `staged`, `fileName`, `onCommit`, `onCancel` (see `App.tsx:222-228`). `onCommit` body shape `{ monthKey, model, plant }`.
- `StandardsDialog`: props `standards`, `historyColors`, `onSave`, `onClose` (see `App.tsx:230-236`).

- [ ] **Step 1:** Reimplement both on `Dialog`/`DialogContent`/`DialogHeader`/`DialogFooter`, inputs via `@/components/ui/input` + `@/components/ui/select`, actions via `Button`. Preserve every prop, the commit/save payload shapes, and validation.
- [ ] **Step 2: Verify** — `npm test -w @cf-wavescan/shared` (15 PASS) + `npm run build -w @cf-wavescan/frontend`.
- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ImportReviewDialog.tsx frontend/src/components/StandardsDialog.tsx
git commit -m "feat(frontend): port dialogs to shadcn Dialog"
```

---

### Task 13: Delete legacy features + dead code

**Files:**
- Delete: `frontend/src/components/TrendCard.tsx`, `frontend/src/components/DetailCard.tsx`, `frontend/src/components/AppBar.tsx`, `frontend/src/components/Sidebar.tsx`, `frontend/src/components/FilterBar.tsx`, `frontend/src/styles/app.css`
- Modify: `frontend/src/App.tsx`, `frontend/src/main.tsx`

**Interfaces:** After this task, `App.tsx` imports none of the deleted modules and the toast can use `sonner`.

- [ ] **Step 1: Remove from `App.tsx`** the imports and JSX for `TrendCard`, `DetailCard`, `AppBar`, `Sidebar`, `FilterBar`. Remove `detailColor`/trend-compare wiring that only those used. Replace the custom `#toast` div with `sonner` `toast(...)` (and `showToast` calls).
- [ ] **Step 2: Remove the legacy css import** in `main.tsx` (drop `import './styles/app.css'`); delete the file. Add `<Toaster />` (from `@/components/ui/sonner`) in `main.tsx` or `App.tsx`.
- [ ] **Step 3: Delete the files** and confirm no references remain:

```bash
git rm frontend/src/components/TrendCard.tsx frontend/src/components/DetailCard.tsx frontend/src/components/AppBar.tsx frontend/src/components/Sidebar.tsx frontend/src/components/FilterBar.tsx frontend/src/styles/app.css
grep -rn "TrendCard\|DetailCard\|AppBar\|FilterBar\|styles/app.css\|Trend compare" frontend/src || echo "clean"
```
Expected: `clean`.

- [ ] **Step 4: Verify** — `npm test -w @cf-wavescan/shared` (15 PASS) + `npm run build -w @cf-wavescan/frontend`.
- [ ] **Step 5: Commit**

```bash
git add -A frontend/src
git commit -m "feat(frontend): delete legacy trend/checkzone/toolbar features"
```

---

### Task 14: Full verification + desktop build

**Files:** Modify `desktop/package.json` (version bump), none in frontend.

- [ ] **Step 1: Bump desktop version** `1.0.4` → `2.0.0` in `desktop/package.json` (major: UI rewrite + removed features).
- [ ] **Step 2: Shared tests** — `npm test -w @cf-wavescan/shared` → 15 PASS.
- [ ] **Step 3: Frontend build** — `npm run build -w @cf-wavescan/frontend` → succeeds, no `require is not defined`.
- [ ] **Step 4: Desktop installer** — `npm run dist:win -w @cf-wavescan/desktop` → produces `desktop/release/CF Wavescan Analyzer Setup 2.0.0.exe`.
- [ ] **Step 5: Headless backend smoke** (as used previously): run the packaged `server.js` under Electron with `ELECTRON_RUN_AS_NODE=1`, hit `/api/health`, import a sample row → confirm 200s + better-sqlite3 loads on Electron ABI.
- [ ] **Step 6: Manual smoke (user, GUI)** — launch `desktop/release/win-unpacked/CF Wavescan Analyzer.exe`: import an Excel file → KPI cards, status charts, Pareto, problem-zones table render; sidebar filters + month/file selects work; Standards + Import dialogs open; **no** trend/checkzone/comparison/Trend-compare UI anywhere; toggle dark mode contrast OK.
- [ ] **Step 7: Commit**

```bash
git add desktop/package.json
git commit -m "chore(desktop): bump to 2.0.0 for v2 UI shell"
```

---

## Self-Review

**Spec coverage:** stack/init (T1,4), @efferd registry + inspection (T2,5), Ford Blue (T3), no-auth strip (T5), layout (T5), keepers ported — DropZone (T8), Andon (T9), ProblemZones (T10), charts/Plotly (T11), dialogs (T12), topbar/sidebar (T6,7); deletions trend/checkzone/toolbars (T13); verification incl. 15 tests + desktop build (T14). All spec sections mapped.

**Placeholder scan:** config/theme/wiring tasks carry full code; port tasks name exact files + props to preserve and require reading the source (intentional — the logic must be copied verbatim, not paraphrased). No `TBD`/`add error handling`-style gaps.

**Type consistency:** prop lists for `AppTopbar`/`AppSidebar`/dialogs copied from the live `App.tsx` usage line ranges; the `.drop input[type=file]` selector hook is explicitly preserved (T8) because `App.tsx` Import depends on it; `PlotlyChart.tsx` is frozen (T11).

**Risk reminders:** vite.config CommonJS transform preserved (T1); CSP-safe fonts (T2/T5); registry inspected before pull (T2 gates T5).
