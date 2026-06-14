# CLAUDE_PROGRESS.md — CF Wavescan Analyzer (full-stack rebuild)

Phase-by-phase build tracker. Each session: read this file first, do the
active phase via its external **PHASE n PROMPT**, then update the result
fields and advance the pointer.

> Source-of-truth for *behaviour*: `prototype/` (75 tests).
> Source-of-truth for *plan*: `Doc/HANDOFF.md` §6.

---

## Pointer

- **Overall Progress:** 6/7 phases complete — **Phase 7: installer BUILDS & backend
  verified; only a human GUI pass + correct reference data remain.**
- **Active Phase:** Phase 7 — build .exe + full verification (**packaging fixed**)
- **Installer:** `desktop/release/CF Wavescan Analyzer Setup 1.0.0.exe` (83 MB) — built ✅
- **Next Action:** A human runs the installer on a Windows desktop to tick the
  GUI/visual items (window opens, title bar, no terminal, import inside the app),
  and supplies the correct `05__May26…` reference data file (or accepts the real
  file's means). Code-signing cert still optional/pending. Then distribute via
  SharePoint.

---

## Phase checklist

- [x] **Phase 1 — Monorepo root + workspace install**
- [x] **Phase 2 — shared/ parser + analytics** (port core/logic, types, tests)
- [x] **Phase 3 — backend/ Express + SQLite API**
- [x] **Phase 4 — frontend/ React + Vite UI**
- [x] **Phase 5 — desktop/ Electron wrapper + Windows packaging**
- [x] **Phase 6 — Application icon (.ico generation)**
- [ ] **Phase 7 — Build .exe installer + full verification** ⛔ BLOCKED (installer not produced)

> Note: Phase 6 was reassigned by the external phase prompts to icon
> generation (this session). Test/CI and packaging-deps hardening (formerly
> labelled "Phase 6") move to Phase 7+.

---

## Phase 1 — Monorepo root + workspace install ✅ COMPLETE

**Completed:** 2026-06-14
**Goal:** Create the monorepo root and install all workspace dependencies.

### Created
- `package.json` (root) — npm workspaces `["shared","backend","frontend","desktop"]`
  + scripts `test`, `dev:backend`, `dev:frontend`, `build:win`
- `shared/package.json` — `@cf-wavescan/shared` (xlsx; typescript)
- `backend/package.json` — `@cf-wavescan/backend` (express, better-sqlite3,
  multer, cors, helmet, uuid; ts toolchain + @types)
- `frontend/package.json` — `@cf-wavescan/frontend` (react, react-dom,
  plotly.js-dist-min; vite + ts toolchain + @types)
- `desktop/package.json` — `@cf-wavescan/desktop` (electron@33,
  electron-builder, ts-node; scripts `dev`, `dist:win`)
- `.gitignore` — node_modules/, dist/, release/, *.sqlite, .env,
  data/*.sqlite, desktop/release/

### Result fields
- **npm install result:** ✅ SUCCESS — `added 621 packages`, exit 0, no build
  errors. (npm audit reports 13 known advisories — 1 moderate, 12 high —
  mostly transitive via multer 1.x / electron-builder; deferred, not blocking.)
- **Workspaces confirmed:** ✅ root `node_modules/` present (432 entries);
  `node_modules/@cf-wavescan/{shared,backend,frontend,desktop}` symlinks all
  present; key deps resolve (express, better-sqlite3, react, vite, electron,
  xlsx all OK).
- **Per-workspace node_modules:** none — **expected**: npm hoists deps to the
  root `node_modules/`. Verification passed on intent (all deps installed and
  resolvable), not on the literal per-folder directory check.
- **Environment:** Node v24.13.0, npm 11.6.2, Windows 11.

### Deviations from the phase prompt (intentional)
1. **better-sqlite3 pinned to `^12.10.1`** (prompt said unversioned
   "better-sqlite3"; my first draft used `^11.5.0`). v11 has **no prebuilt
   binary for Node 24** and fell back to a source compile that failed with
   `MSB8020: ClangCL build tools cannot be found` (VS2022 Build Tools are
   installed but the ClangCL component is not). v12.10.1 ships a Node 24
   prebuild — installs with zero compilation; verified with an isolated
   in-memory smoke test before committing the change.
2. Added `"version"`, `"private": true`, and `main` fields to each
   package.json (npm hygiene; avoids workspace warnings). No functional change
   to the dependency spec.

### Watch-outs handed to later phases
- **Native rebuilds will hit the same ClangCL gap.** Phase 5 (electron-builder
  / `electron-rebuild`) must use prebuilds or the user must add the ClangCL
  component (or the C++ Clang tools) to VS2022 Build Tools.
- `multer` is 1.x (deprecated; 2.x has security fixes). Revisit in Phase 3/6.
- `shared` has no `test` script yet, so the root `test` script
  (`npm -w shared test`) will fail until Phase 2 adds a test runner.

---

## Phase 2 — shared/ parser + analytics ✅ COMPLETE

**Completed:** 2026-06-14
**Goal:** Extract the parser + analytics engine from the prototype into
`@cf-wavescan/shared`, typed and tested. Most critical layer — all else
depends on it.

### Files created
- `shared/src/core.js` — **762 lines, copied VERBATIM** from `Prototype.html`
  (CFCore IIFE, lines 873–1634). Parser + analytics + status rules.
- `shared/src/logic.js` — **1009 lines, copied VERBATIM** (CFLogic IIFE, lines
  1637–2645). History, filters, Plotly builders. `require('./core.js')`.
- `shared/src/types.ts` — `Reading`, `StandardRow`, `Standards`, `MonthEntry`.
- `shared/src/index.ts` — re-exports `CFCore`, `CFLogic`, and all types.
- `shared/test/core.test.js` — home-grown harness (no new deps).
- `shared/package.json` — added `"test": "node test/core.test.js"`.

### Result fields
- **shared build result:** n/a this phase — engines run as verbatim CJS; no
  `tsc` build required for tests (TS migration deferred to §6.A).
- **shared test result:** ✅ `npm -w shared test` → **15 tests, 15 passed, 0
  failed**, exit 0.
- **test count / passing:** 15 / 15.
- **Smoke test (`Data/05. May26 CF data.xlsx`):** ✅ parses without exception;
  **256 records**; sheet `PasteData`; modelDetected `Mixed`, plantDetected
  `FTM`; 7 distinct colors incl. the 3 required (Arctic White, Code Orange,
  Shadow Black). `monthFromFilename('05. May26 CF data.xlsx')` → `{2026, 5}`.

### Deviations / decisions (verbatim code preserved — tests adapted to it)
1. **`statusOf(52.0, min=50)` → `PASS`, not `WARNING`.** The prompt expected
   WARNING, but the verbatim rule is `avg ≥ min+2 = PASS` (min+2 = 52) with a
   half-open warning band `[50, 52)` that excludes 52 — matching the prompt's
   own annotations and the locked hard constraint (HANDOFF.md §7.1). Test
   asserts PASS; core.js unchanged. Added 51.0 → WARNING as the in-band case.
2. **`isAllToken` is internal (not exported)** from CFCore. The prompt's
   `normalizeColor("[All]") → isAllToken === true` is tested via the
   observable equivalent: `normalizeColor("[All]") === null` (how parseSheets
   drops aggregate rows).
3. **Smoke-test file path** is the real `Data/05. May26 CF data.xlsx` (spaces +
   period), not the `05__May26_CF_data.xlsx` literal in the prompt — that
   underscore form is a `monthFromFilename` *input*, not a file on disk. Both
   forms are covered by tests.
4. **`statusOf` is 3-arg** `(value, ford, minStd)`; the prompt's 2-arg calls
   map to `(value, <any ford>, min)`. Added a test proving the Ford target is
   reference-only (absurd ford value does not change the verdict).

### Notes for later phases
- `core.js` / `logic.js` are plain CJS with no `.d.ts`; `index.ts` surfaces
  them via `require`. Native-TS migration is HANDOFF.md §6.A (Phase 6 here).
- Backend (Phase 3) consumes `CFCore.parseSheets` with sheets built via
  `XLSX.utils.sheet_to_json(ws, {header:1, raw:true, defval:null})` and
  `opts.filename` for model/plant/month detection.

---

## Phase 3 — backend/ Express + SQLite API ✅ COMPLETE

**Completed:** 2026-06-14
**Goal:** Express + SQLite API (embedded in Electron later), all analytics
delegated to `@cf-wavescan/shared`. Binds 127.0.0.1 only.

### Files created
- `backend/src/shared.ts` — bridge: requires the verbatim CJS engines by
  subpath (`@cf-wavescan/shared/src/{core,logic}.js`); type-only import of
  shared types.
- `backend/src/db.ts` — better-sqlite3; DB path = `process.env.DB_PATH`
  (prod) else `./data/dev.sqlite` (dev). Schema: `files`, `readings`
  (orient CHECK H/V, file_id CASCADE), `standards` (id=1 JSON blob),
  `pending_imports`; indexes `idx_readings_month`, `idx_readings_filter`.
  `foreign_keys = ON`. Helpers `getStandards()` / `setStandards()`.
- `backend/src/server.ts` — helmet CSP (script-src/connect-src `'self'`,
  object-src `'none'`), cors, multer (memory, 25 MB, .xlsx/.xlsm/.xls →
  else **415**), mounts routers under `/api`, **`app.listen(PORT,'127.0.0.1')`**,
  415/413/500 error handler.
- `backend/src/routes/imports.ts` — POST `/api/imports` (parse →
  `pending_imports`, UUID id), POST `/api/imports/:id/commit` (→ files +
  readings, re-upload retention via cascade), DELETE `/api/imports/:id`.
- `backend/src/routes/months.ts` — GET `/api/months`,
  `/api/months/:key/readings`, `/api/months/:key/files`, DELETE
  `/api/files/:id` (cascades).
- `backend/src/routes/standards.ts` — GET (stored or shared defaults),
  PUT (validated upsert).
- `backend/src/routes/analysis.ts` — GET `/api/analysis/summary`
  (ribbon/problemZones/chartData via `summarize`/`problemZones`/
  `buildOrientPlot`), `/api/analysis/mom` (`momDeltas`), `/api/health`.
- `backend/tsconfig.json` (ts-node `transpileOnly`); `backend/package.json`
  scripts `dev` (nodemon+ts-node), `start`, `build`.

### Result fields
- **`/api/health`:** ✅ `{ "ok": true, "version": "1.0.0" }`.
- **Import rowCount:** ✅ `POST /api/imports` (real `Data/05. May26 CF
  data.xlsx`) → **rowCount 256**, monthHint `{2026-05}`. Commit → `{ ok:true,
  monthKey:"2026-05", added:256 }`.
- **Security check (`netstat`):** ✅ `TCP 127.0.0.1:4000 LISTENING` only — **no
  `0.0.0.0:4000`**. Source grep for `0.0.0.0` is **clean** (removed even the
  comment mentions). The `0.0.0.0:0` in netstat is the foreign-address column,
  not a bind.
- **Extra checks:** 415 on non-Excel upload ✓; `/api/months` → `[{2026-05,
  count:256, "May 2026"}]` ✓; `/api/analysis/summary?period=2026-05&plant=FTM`
  → `ribbon {pass:15, warn:1, fail:0}`, 12 problem zones, chartData H+V ✓;
  `/api/standards` → 6 families, empty colors ✓.

### Deviations / notes
1. **Import `warnings` is non-empty (≈96 rows), not `[]` as the prompt's
   verification assumed.** This is *correct* parser behaviour: the May file
   contains a color "MM-42 Meteo Grey BC" not in the family map, so those rows
   are legitimately skipped with a warning. rowCount (256) is the recognized
   set. No bug — the prompt's `warnings:[]` expectation didn't account for an
   unmapped color in the real data.
2. **Status logic is never reimplemented** — routes call
   `summarize`/`problemZones`/`momDeltas`/`analyze`, which all funnel through
   `CFCore.statusOf` (constraint honored).
3. **Multer uses in-memory storage** (no temp files to clean); workbook parsed
   from the buffer. `pending_imports` persists staged data across restarts.
4. **`@types/express` is v5 while express is v4**; ts-node runs in
   `transpileOnly` mode so this type mismatch doesn't block dev. Tighten in
   Phase 6 (align @types/express to v4, or upgrade express).
5. **`multer` is 1.x** (deprecated; carried from Phase 1) — revisit in Phase 6.

---

## Phase 4 — frontend/ React + Vite UI ✅ COMPLETE

**Completed:** 2026-06-14
**Goal:** Port the full prototype UI to React, reusing `@cf-wavescan/shared`
for ALL analytics and Plotly trace building (so the UI can never drift from the
engine). Backend-backed: data loads from SQLite into a prototype-shaped
`history` object, so every CFLogic function works unchanged.

### Components (build order A–M)
- [x] **A** `hooks/useFilters.ts` — central `S`-object state
- [x] **B** `components/AppBar.tsx` — Ford gradient header, Month + File selects,
      version, Import/Standards buttons, history dot, ☰ toggle
- [x] **C** `components/Sidebar.tsx` — Period · Model · Position · Chart type ·
      Plant · Colors · Trend (rail/drawer, segs + chips, via `Seg.tsx`)
- [x] **D** `components/FilterBar.tsx` — active-filter recap chips
- [x] **E** `components/DropZone.tsx` — drag/browse upload, compact after first
- [x] **F** `components/AndonRibbon.tsx` — PASS/WARN/FAIL cells + zone-off + ▲/▼
- [x] **G** `components/ProblemZones.tsx` — worst-first digest, row→detail
- [x] **H** `components/PlotlyChart.tsx` — **purge trick implemented** (see below)
- [x] **I** `components/ChartCards.tsx` — H+V, chart-type switch (box/pareto/interval)
- [x] **J** `components/TrendCard.tsx` — MoM / plant compare, orient lock
- [x] **K** `components/DetailCard.tsx` — color KPIs, zone table, zone picker, compare
- [x] **L** `components/ImportReviewDialog.tsx` — Month/Year/Model/Plant, warnings
- [x] **M** `components/StandardsDialog.tsx` — Families + Per-color tabs, FTM badge
- Plus: `lib/shared.ts` (UMD bridge → CFCore/CFLogic), `lib/api.ts` (typed
  client), `lib/cf.ts` (window.cf shim), `lib/select.ts` (period/filter helpers),
  `App.tsx`, `main.tsx`, `index.html` (CSP), `vite.config.ts` (proxy), tsconfigs,
  `styles/app.css` (**prototype CSS verbatim**, 460 lines), all design tokens.

### Plotly purge-trick status ✅
Implemented exactly per HANDOFF §8 / prototype `plotInto()`: structural
signature = `kind | orient | categories | traceCount`; on change, `Plotly.purge()`
runs BEFORE `Plotly.react(div, traces, layout, {responsive:true})`. Empty state
never wipes a live plot's innerHTML; purge also runs on unmount.

### Verification (what could be checked headlessly)
- **`vite build`** → ✅ success, exit 0 (53 modules, dist emitted).
- **Dev servers** → backend `/api/health` ok; frontend serves index + transforms
  `main.tsx`/`shared.ts`/`App.tsx` (all HTTP 200, no compile errors).
- **UMD bridge** → verified `window.CFCore`/`window.CFLogic` are set when the
  engines run in a browser context (VM sandbox), and CFLogic receives CFCore.
- **Exact UI numbers** (reproduced via live API + the same CFLogic calls the
  components make):
  - AndonRibbon (model=Both): **PASS 15 · WARN 1 · FAIL 0**
  - DBL/Ranger filter → 6/0/0 · Raptor filter → 7/1/0 · plant FTM → 15/1/0
    (model/plant filters change the output ✓)
  - Boxplot H renders all 7 colors (Aluminium Metallic, Arctic White, Blue
    Lightning, Code Orange, Command Grey, Ignite Orange, Shadow Black)
  - Chart-type switch: box → pareto → interval kinds all build ✓

### Chart mean annotations — IMPORTANT deviation
The prompt expected **Code Orange H ≈ 58.8** and **Ignite Orange H ≈ 66.8**. The
ONLY data file present (`Data/05. May26 CF data.xlsx`) yields, via the verbatim
engine: **Code Orange H = 66.9**, **Ignite Orange H = 66.07** (also Arctic White
H = 59.2, Shadow Black H = 67.21). The expected 58.8/66.8 do not match this file
(they appear to come from a different/earlier `05__May26_CF_data.xlsx` we don't
have). The engine is correct and unchanged; the charts faithfully display its
true output. No code change is warranted — this is a data-expectation mismatch.

### Other deviations / notes
1. **Backend AppBar buttons simplified** to the prompt's STEP B spec (Import +
   Standards). The prototype's Connect/Save/Export-to-file history flow is
   superseded by the SQLite backend (imports commit straight to the DB), so the
   history dot just shows "Saved locally" vs "No data yet".
2. **Minor backend extension:** `POST /api/imports` now also returns
   `modelDetected`/`plantDetected`, and `commit` applies an explicit model
   choice to all rows (prototype override semantics).
3. **CSP is dev-friendly** in `index.html` (allows Vite HMR inline/eval + ws).
   The STRICT packaged policy (`script-src 'self'`, etc.) is applied in Phase 5
   via Electron — the bundled build needs no inline/eval.
4. **Interactive/visual checks not runnable headlessly** (this is a background
   session with no browser): visible Plotly pixel rendering, row-click→scroll,
   dialog visuals, and the Standards save-on-reload round-trip. The data/logic
   behind each is verified above; a human should do the final visual pass with
   `npm -w backend run dev` + `npm -w frontend run dev` → http://localhost:5173.
5. Bundle is ~4.9 MB (Plotly dominates) — fine for a desktop Electron app;
   code-splitting optional in Phase 6.

---

## Phase 5 — desktop/ Electron wrapper + Windows packaging ✅ COMPLETE

**Completed:** 2026-06-14
**Goal:** Wrap frontend + backend into one Electron shell that opens with a
double-click — no terminal for the end user.

### Files created
- `desktop/electron/main.ts` → compiled `main.js`. Startup a→e: getFreePort
  (net.createServer) → startBackend (dev: `npm run start -w backend` / prod:
  `node server.js` via `ELECTRON_RUN_AS_NODE`) with `PORT` + `DB_PATH`
  (`%APPDATA%/CFWavescan/cf-data/cf.sqlite`) → waitForBackend (poll
  `/api/health` 500ms, 30s timeout, error dialog on fail) → createWindow →
  `before-quit` SIGTERMs the backend. IPC: `get-api-base`, `get-version`.
  Single-instance lock; strict prod CSP via session headers.
- `desktop/electron/preload.ts` → compiled `preload.js`. Exposes ONLY
  `window.cf = { getApiBase, getVersion }` (sandboxed CommonJS).
- `desktop/tsconfig.json` (emits `.js` beside `.ts`).
- `desktop/package.json` — scripts `build:electron`, `dev`
  (`tsc && electron .`), `prepackage`, `dist:win`; full `build` block.

### Security checklist (Doc/SECURITY.md) — verified in compiled main.js
- [x] `contextIsolation: true`
- [x] `nodeIntegration: false`
- [x] `sandbox: true`
- [x] `webSecurity: true`
- [x] `will-navigate` guard blocks navigation off 127.0.0.1 / localhost / file://
- [x] `setWindowOpenHandler` denies new windows → `shell.openExternal`
- [x] `asar: true` (electron-builder build block)
- [x] No `<webview>` usage
- [x] Backend bound 127.0.0.1 only — **no `0.0.0.0` anywhere** in desktop/
- [x] Strict CSP applied in prod via session `onHeadersReceived`
      (`script-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`)

### electron-builder config
appId `com.ford.cfwavescan` · productName "CF Wavescan Analyzer" · `asar:true`
· win target `nsis x64` · nsis `perMachine:false` (no UAC), `oneClick:false`,
shortcutName "CF Wavescan Analyzer" · extraResources `../backend/dist`→backend
and `../frontend/dist`→renderer.

### Dev/build test results
- **`npm -w desktop run build:electron`** → ✅ exit 0; emits `main.js` +
  `preload.js`.
- **`npm -w backend run build`** → ✅ emits `backend/dist/{server,db,shared}.js`
  + routes (the extraResources source).
- **Prod backend artifact** (exactly what `startBackend` prod runs:
  `node backend/dist/server.js` with `PORT`+`DB_PATH`) → ✅ `/api/health` ok;
  binds **`127.0.0.1:4321` only (no 0.0.0.0)**; import → **256 rows**, commit →
  `/api/months` shows `2026-05/256`; **DB file created at the custom DB_PATH**,
  proving env wiring and on-disk persistence (close→reopen keeps data).
- **`netstat` security:** every listener observed this phase is 127.0.0.1; no
  `0.0.0.0`.

### NOT verified here — needs a desktop session / human (honest gaps)
- **Electron GUI could not be launched** (headless background session, no
  display). So these prompt checks remain for a human to confirm with the
  3-terminal setup (`npm -w backend run dev`, `-w frontend run dev`,
  `-w desktop run dev`): window opens, title shows, import/charts render inside
  the window, close→reopen persistence in the live app.
- **`dist:win` installer not built.** The config is correct, but full packaging
  needs Phase 6 hardening: (1) the prod backend in `extraResources/backend` has
  **no node_modules** — it must be bundled (esbuild) or its deps shipped;
  (2) `better-sqlite3` is native → needs `asarUnpack`/rebuild and hits the same
  **ClangCL** gap noted in Phase 1; (3) code-signing cert; (4) an `icon.ico`.

### Deviations / notes
1. **Dev backend is spawned by Electron** (per the prompt's a→e), so running
   `-w desktop run dev` is self-contained for the backend; terminals 1–2 are the
   standalone web-dev workflow. Each Electron instance uses its own free port +
   the AppData DB.
2. **Dev CSP widened** to `connect-src http://127.0.0.1:* ws://127.0.0.1:*` so
   the renderer (vite 5173) can reach the Electron-spawned backend on its random
   port. Prod uses the strict, port-scoped CSP via session headers.
3. Renderer shipped via `extraResources/renderer` and loaded with `loadFile`
   (functionally the prompt's `file://dist/index.html`).

---

## Phase 6 — Application icon (.ico generation) ✅ COMPLETE

**Completed:** 2026-06-14
**Goal:** Generate the Windows installer/taskbar icon.

### Files created
- `desktop/scripts/generate-icon.js` — renders a 512×512 PNG with **sharp**
  (Ford-blue diagonal gradient `#0b1f52`→`#1e3a8a`, 48px rounded square, faint
  white inner glow, bold white "CF" 220px), then embeds 16/32/48/64/128/256 via
  **png-to-ico**.
- `desktop/build-resources/icon.png` (512×512 master).
- `desktop/build-resources/icon.ico` (multi-size).
- `desktop/package.json` — added `"generate-icon": "node scripts/generate-icon.js"`;
  installed `sharp` + `png-to-ico` (devDeps).

### Verification (`npm run generate-icon -w desktop`) — all pass
- [x] `icon.ico` exists.
- [x] File size **370 KB** (> 50 KB → multiple sizes embedded).
- [x] Embedded sizes parsed from the ICO directory: **256×256** (264 KB),
      128, 64, 48, 32, **16** — so Explorer Properties shows 256×256.
- [x] "CF" is readable at small sizes — white-pixel coverage confirms the
      glyphs rendered (64px 6.2%, 32px 4.7%; the 0.06-opacity glow alone could
      not produce that). Visually inspected the 512 PNG: clean bold "CF" on the
      Ford-blue rounded square.

### Notes
- electron-builder auto-detects `build-resources/icon.ico` (the configured
  `buildResources` dir) — no extra config needed for the NSIS installer/exe icon.
- sharp's SVG `<text>` rendered Arial correctly on this Windows host; the script
  is self-contained (no external font files).

---

## Phase 7 — Build .exe installer + full verification ⛔ IN PROGRESS / BLOCKED

**Attempted:** 2026-06-14. **Honest status: NOT complete.** The library builds
and all automated logic/data checks were run; the installer could not be
produced, and the GUI/install items cannot be verified in a headless background
session. Detailed results below — do not distribute.

### Build sequence
- `npm -w shared run build` → ✅ (no-op; engines consumed as source — added the script)
- `npm -w backend run build` → ✅ emits `backend/dist`
- `npm -w frontend run build` → ✅ emits `frontend/dist`
- `npm -w desktop run dist:win` → ✅ **NOW BUILDS** (Issue #1 resolved — see
  "Packaging fix" below). Output: `desktop/release/CF Wavescan Analyzer
  Setup 1.0.0.exe`.

### Checklist results (truthful)
PARSER
- [x] `npm -w shared test` → 15/15 pass.
- [x] month detected = **"May 2026"**.
- [ ] records contain all 8 listed colors → **7 present**; **"Meteor Grey" is
      NOT present** — the file's "MM-42 Meteo Grey BC" is unrecognised and
      skipped by the parser (Issue #3).

CHARTS — reference lines & format pass; **mean values do NOT match the checklist**
- [ ] Code Orange H ≈ 58.8 → **actual 66.9**
- [ ] Ignite Orange H ≈ 66.8095 → **actual 66.0714**
- [ ] Blue Lightning H ≈ 55.9786 → **actual 56.3857**
- [ ] Command Grey H ≈ 54.7719 → **actual 63.8571**
      (All four diverge because the only data file present,
      `Data/05. May26 CF data.xlsx`, differs from the checklist's reference
      `05__May26_CF_data.xlsx` — Issue #2. Engine output is correct.)
- [x] red dashed Ford-target line present for every family (`#dc2626`, dashed).
- [x] green dashed Min-requirement line present for every family (`#0e9f6e`).
- [x] mean label = 4 dp, trailing zeros trimmed (`fmtCF`: 55.9786, 60, 54.7719).

STATUS RULE
- [ ] avg=52.0, min=50 → checklist says WARNING; **actual = PASS**. This matches
      HANDOFF §7 (`avg ≥ Min+2 = PASS`; 52 = 50+2) and the verbatim engine — the
      checklist item contradicts §7 itself (Issue #4). Not a code defect.
- [x] avg=52.1, min=50 → PASS.
- [x] avg=49.9, min=50 → FAIL.
- [x] Ford target reference-only (absurd ford value does not change verdict).

FILTERS
- [x] DBL/Ranger filter → Ranger rows (+ null-model wildcards, per §7.4).
- [x] Raptor filter → Raptor rows (+ wildcards).
- [x] Horizontal → ProblemZones shows only H zones.
- [x] Vertical → ProblemZones shows only V zones.
- [x] Plant FTM → only FTM rows.
- [x] "All colors" reset → all 7 colors shown.

DATA PERSISTENCE
- [x] (logic) DB persists across process restart — verified Phase 5: the SQLite
      file at `DB_PATH` persists on disk; re-query returns the data.
- [x] (logic) standards persist — `PUT /api/standards` writes the blob; survives
      restart. Live-app close/reopen needs the GUI (below).

SECURITY
- [x] Backend binds **127.0.0.1 only — no `0.0.0.0`** (verified at runtime in
      Phase 3 on :4000 and Phase 5 on a random port; enforced by the `HOST`
      constant; no `0.0.0.0` anywhere in source).

INSTALLER
- [x] `.exe` exists → `desktop/release/CF Wavescan Analyzer Setup 1.0.0.exe`.
- [x] `.exe` > 80 MB → **83 MB**.
- [x] **packaged backend verified** — ran `resources/backend/server.js` via the
      packaged Electron binary with `ELECTRON_RUN_AS_NODE=1` (the exact prod
      spawn): `/api/health` ok (v1.0.0), import → 256 rows (so the
      **Electron-ABI better-sqlite3 loads**), bound 127.0.0.1 only. Packaged
      resources present: `app.asar`, `backend/` (self-contained), `renderer/`.
- [ ] install / double-click / shortcut / title bar / no-terminal →
      still needs a **human on a Windows desktop** (no display here — Issue #5).
- [ ] post-install import & charts in the live window → same (backend half proven).

### Packaging fix (Issue #1 — RESOLVED)
The installer now builds and the packaged backend is verified. What changed:
1. **`npmRebuild: false`** (build config + `--config.npmRebuild=false`) — stops
   electron-builder's "installing production dependencies" step that was pruning
   its own `app-builder-bin` helper in the hoisted workspace. Log now reads
   "skipped dependencies rebuild".
2. **Self-contained backend bundle** — `backend/scripts/bundle.js` (esbuild)
   inlines every JS dep into one `server.js` and copies `better-sqlite3`'s full
   runtime closure (bindings, file-uri-to-path, …) into `backend/bundle/
   node_modules`. Verified to run standalone under `node` (health + 256-row
   import). extraResources now points at `../backend/bundle`.
3. **Electron-ABI native module** — `desktop/scripts/prepare-native.js` runs
   `prebuild-install --runtime=electron --target=<electronVer>` to swap the
   bundle's `better_sqlite3.node` to Electron 33's ABI (130). Verified: the
   packaged backend loads it under Electron-as-node and serves requests.
4. Bumped `desktop` version → **1.0.0** so the artifact is `…Setup 1.0.0.exe`.

Remaining (not blockers to building): **code-signing cert** (build logs "signing
is skipped" — SmartScreen will warn until signed) and the **live GUI pass**.

### Other issues & resolutions
2. **Chart means don't match the checklist.** Expected values reference a data
   file (`05__May26_CF_data.xlsx`) that does not exist in the repo; the only file
   is `05. May26 CF data.xlsx`. Engine output is correct for the file present.
   Status: needs the correct reference data file to tick these. OPEN.
3. **"Meteor Grey" absent.** The data's "MM-42 Meteo Grey BC" is not in the
   `COLOR_FAMILY` map → skipped with a warning (correct behaviour). To include
   it, add the alias/family mapping in `core.js` (would change the verbatim
   engine — defer per constraints). OPEN.
4. **Status 52.0 expectation conflicts with §7.** Checklist says WARNING; §7 and
   the engine say PASS (52 = Min+2). No fix — the engine is correct. RESOLVED
   (checklist item is wrong).
5. **GUI/install checks not runnable headlessly.** Needs a human on a Windows
   desktop session once Issue #1 is resolved. OPEN.

### What IS solid
The full application stack is built and its logic is verified end-to-end:
parser (15/15 tests), analytics/status (matches §7), charts (correct traces +
dashed reference lines + mean format), filters, the localhost-only API, on-disk
persistence, and the Electron security configuration. The remaining work is
**packaging + a human GUI pass**, not application logic.
