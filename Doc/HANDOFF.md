# Handoff — CF Wavescan Analyzer (full-stack rebuild)

**Audience:** the next Claude Code (or any developer) picking this up in a
fresh environment. Skim §0 and §1 before doing anything. §6 onward is the
ordered TODO list.

---

## 0. One-paragraph context

CF Wavescan is a paint-appearance dashboard for Ford assembly plants
(FTM/AAT/FVL/SAP). It started life as a single 5.5 MB `analyzer.html`
prototype (preserved under `prototype/`) and has now been split into a
three-package monorepo (`shared/`, `backend/`, `frontend/`) wrapped in an
Electron desktop shell (`desktop/`) that ships as a signed `.exe`
installer. The product user is a senior engineer who **does not use
developer tooling** — the deliverable is a double-click installer; no
terminal, no Node install. The IT review story is "single signed binary,
local SQLite, zero outbound calls".

## 1. What's already done in this codebase

- **`prototype/`** — the legacy single-HTML app, fully working, 75 tests
  passing. Treat it as the spec for behaviour. Anything ambiguous in this
  doc: read `prototype/src/app.js` and `prototype/src/applogic.js` —
  those files document every decision in comments.
- **`shared/`** — `core.cjs` (parser + analytics) and `logic.cjs`
  (history, filters, plot builders) lifted verbatim from the prototype.
  Tests pass: 36 core + 32 logic = 68 passing. A `types.ts` and
  `index.ts` wrap them so the rest of the monorepo gets typed consumers.
  Migration path: rewrite the `.cjs` files as native `.ts` incrementally
  (see §6.A).
- **`backend/`** — Express + SQLite skeleton. Routes mounted but not yet
  hardened: `/api/imports` (multipart upload + 2-step commit),
  `/api/months`, `/api/standards`, `/api/analysis/summary`,
  `/api/analysis/mom`. Server binds **127.0.0.1 only**. DB lives at
  `<userData>/cf-data/cf.sqlite`.
- **`frontend/`** — React + Vite + TypeScript skeleton. Renders the app
  bar, a drop zone, and the months-in-DB table. Plotly charts and the
  full filter sidebar are not yet ported.
- **`desktop/`** — Electron main + preload with hardened defaults
  (contextIsolation, sandbox, no nodeIntegration, will-navigate guard,
  windowOpenHandler defers to OS browser). `electron-builder` config is
  set up for Windows NSIS installer and signed-binary metadata.
- **`docs/`** — this file, the original `PROJECT.md` (business rules),
  plus `ARCHITECTURE.md` and `SECURITY.md` (read these BEFORE making
  structural changes).

## 2. Why this stack (architecture decisions)

| Concern | Decision | Reason |
|---|---|---|
| Desktop shell | **Electron** (not Tauri) | Tauri would be ~10MB vs Electron's ~100MB, BUT Tauri needs a Rust toolchain — friction for next-session dev pickup. Electron is industry-standard, easy to hand off, easy to code-sign with corporate cert. |
| Backend lang | **Node + TypeScript** | Lets us reuse the existing JS parser as-is. A Python backend would force a parser rewrite. |
| Database | **SQLite** (`better-sqlite3`) | Zero admin, single file, ships inside the .exe, lives in `<userData>`. No listening port, no network surface. Trivial swap to Postgres for a future hosted version (one file: `backend/src/db.ts`). |
| Frontend | **React + Vite + TS** | Mature, fast HMR, easy hire. Plotly via `plotly.js-dist-min` (vendored, no CDN). |
| State | **Local React state for now** | Add Zustand or Redux only if the prop-drilling gets painful. Don't introduce TanStack Query until the data shape is settled. |
| Packaging | `electron-builder` → NSIS | Produces signed `.exe` + auto-update artifacts. Disable updates for the air-gapped corporate env. |

If anyone asks "why not Power BI" — the original system *is* Power BI
and the analyst is replacing it because they want (a) automated
ingestion of the Excel exports, (b) deterministic warning/fail rules
tied to the Wavescan minimums, (c) shareable history without the BI
service. We're complementing Power BI, not replacing the data warehouse.

## 3. Repository layout

```
CF/
├── prototype/                # Legacy single-HTML prototype (frozen reference)
│   ├── src/                  # core.js, applogic.js, app.js, styles.css, index.html
│   ├── test/                 # 75 tests (all passing)
│   ├── vendor/               # plotly.min.js, xlsx.min.js (gitignored)
│   ├── build.py
│   └── analyzer.html         # built artifact (gitignored)
│
├── shared/                   # @cf-wavescan/shared — parser + analytics
│   ├── src/
│   │   ├── core.cjs          # ported from prototype (parser + analytics)
│   │   ├── logic.cjs         # ported from prototype (history + filters)
│   │   ├── types.ts          # TS interfaces
│   │   └── index.ts          # public surface
│   ├── test/                 # 68 tests
│   ├── package.json
│   └── tsconfig.json
│
├── backend/                  # @cf-wavescan/backend — Express + SQLite API
│   ├── src/
│   │   ├── server.ts         # boots Express on 127.0.0.1
│   │   ├── db.ts             # SQLite, migrations, history reconstitution
│   │   └── routes/{imports,months,standards,analysis}.ts
│   ├── data/                 # cf.sqlite + uploads (gitignored)
│   └── tsconfig.json
│
├── frontend/                 # @cf-wavescan/frontend — React + Vite + TS UI
│   ├── src/
│   │   ├── App.tsx           # top-level shell (skeleton)
│   │   ├── main.tsx
│   │   ├── components/       # AppBar, Sidebar, DropZone, MonthsList
│   │   ├── lib/api.ts        # typed fetch client
│   │   └── styles/app.css
│   ├── index.html            # CSP set here
│   ├── vite.config.ts        # /api -> 127.0.0.1:4000 in dev
│   └── tsconfig.json
│
├── desktop/                  # @cf-wavescan/desktop — Electron wrapper → .exe
│   ├── electron/
│   │   ├── main.ts           # boots backend on free port, opens BrowserWindow
│   │   └── preload.ts        # narrow `window.cf` bridge
│   ├── build-resources/      # icon.ico, license.txt, installer assets
│   └── package.json          # electron-builder config (NSIS, code-signing)
│
├── docs/
│   ├── PROJECT.md            # business rules (status thresholds, color map, …)
│   ├── ARCHITECTURE.md       # data flow + diagrams
│   ├── SECURITY.md           # IT review answers + hardening checklist
│   └── HANDOFF.md            # THIS FILE
│
├── package.json              # workspaces root
├── README.md
└── .gitignore
```

## 4. First commands in a fresh checkout

```bash
# from repo root
npm install                              # installs all four workspaces
npm -w shared run test                   # sanity-check the ported parser (68 passing)
npm -w shared run build                  # emit shared/dist
npm -w backend run dev                   # boots Express on http://127.0.0.1:4000
# in another terminal:
npm -w frontend run dev                  # Vite at http://localhost:5173 (proxies /api)
# in yet another terminal (when ready to test the wrapper):
npm -w desktop run dev                   # Electron loads the Vite URL
# production .exe:
npm -w desktop run dist:win              # produces desktop/release/CF Wavescan Analyzer Setup *.exe
```

`backend/data/cf.sqlite` is created automatically on first boot. Delete
the file to reset the DB.

## 5. Status of every business rule

| Rule | Where it lives | Notes |
|---|---|---|
| Status: avg≥Min+2=PASS / Min≤avg<Min+2=WARNING / avg<Min=FAIL | `shared/src/core.cjs` → `statusOf()`, `WARNING_BAND=2` | New rule (v2). Ford target stays as reference line only. |
| Per-color standards override (schema v2) | `shared/src/logic.cjs` → `loadHistory()`; `core.cjs` → `targetsFor(family, std, colorName)` | Migrates v1 flat shape forward. |
| `[All]` rows dropped | `core.cjs` → `isAllToken()` | covers Model, Checkzone, Color, Tolerance, Plant cells |
| Dedup by (model, plant, color, orient, zone) | `core.cjs` → `dedupe()` | distinct values averaged at full precision |
| Color → family map (IMG Plants PDF) | `core.cjs` → `COLOR_FAMILY`, `COLOR_ALIASES`, `FTM_COLORS` | Aluminum→Aluminium, Absolute Black→Shadow Black, etc. |
| Model labels: Ranger → display "DBL" | `core.cjs` → `modelLabel()` | |
| Plant detection word-boundary regex | `core.cjs` → `detectPlant()` | so "saptm" doesn't match SAP/FTM |
| File retention on re-upload | backend `routes/imports.ts` commit step | DELETE old `files` row → cascades to `readings` |
| Month-over-month ▲/▼ flags | `logic.cjs` → `momDeltas()` | currently only single-month view |
| Problem checkzones digest | `logic.cjs` → `problemZones()` | sorted FAIL-first by deepest deficit |
| Multi-plant + Period (pooled months) filter | `logic.cjs` → `filterRecords()`, `periodRecords()` | both honoured in backend `/api/analysis/summary` |
| Point-by-point zone picker | `logic.cjs` → `buildZoneCompare(opts.zones)` | UI not ported yet |

## 6. Ordered TODO for the next session

### 6.A — Migrate `shared/src/*.cjs` to native TypeScript (~½ day)

The `.cjs` files are the existing prototype JS, dropped in unchanged so
the migration is risk-free. Replace one file at a time, keeping tests
green between each commit:

1. Rename `core.cjs` → `core.ts`. Add explicit types from `types.ts`.
   Run `npm -w shared test` after each function ported.
2. Same for `logic.cjs` → `logic.ts`. Update `index.ts` to import the TS
   directly instead of `require()`-ing the `.cjs`.
3. Migrate tests to `.test.ts` and a real runner (Vitest recommended:
   `npm i -D vitest -w shared`, replace the home-grown harness).
4. Remove `core.cjs` / `logic.cjs` once nothing depends on them.

### 6.B — Port the prototype UI to React components (~2 days)

The prototype's `app.js` is the design source. Component-by-component:

- `<Sidebar>` with `<PeriodPicker>`, `<PlantChips>`, `<ColorChips>`,
  `<ModelSeg>`, `<OrientSeg>`, `<ChartTypeSeg>`, `<TrendCompare>`.
  Each was a `render…()` function in `app.js`; port the JSX faithfully,
  drive from a single `useFilters()` hook holding the `S` shape.
- `<FilterBar>` summary chips above the andon ribbon
  (`renderFilterBar()` in `app.js`).
- `<AndonRibbon>` — three cells with zone-counts and ▲/▼ flags.
  Pull data from `/api/analysis/summary` and `/api/analysis/mom`.
- `<ProblemZones>` — the worst-offender digest table. Row-click should
  call `setDetailColor(z.color)` and scroll to the detail card.
- `<PlotlyChart>` hook — wrap `plotly.js-dist-min` in a React component
  that calls `Plotly.react(div, traces, layout)` on prop changes, with
  the `purge`-on-signature-change trick (see prototype `plotInto()` —
  there's a regression test for it).
- `<ChartCards>` — H + V side-by-side, switches between Boxplot /
  Pareto / Ranking via the chart-type seg.
- `<TrendCompare>` and `<DetailCard>` with zone multi-select picker.
- `<StandardsDialog>` — two tabs (Families, Per-color overrides), the
  per-color editor with the FTM badge.
- `<ImportReviewDialog>` — the month/year/model confirmation step. Wires
  to `POST /api/imports/:id/commit`.

For data fetching: start with naive `useEffect(() => fetch…, [deps])`.
Introduce TanStack Query only if the cache-invalidation pattern emerges.

### 6.C — Backend hardening (~½ day)

- Replace the in-memory `PENDING` map in `routes/imports.ts` with a
  `pending_imports` table so the user can close & reopen the app
  mid-review without losing the staged data.
- Add a `request-validator.ts` middleware that runs the Zod schemas
  declared in each route file; refuse anything that doesn't match.
- Server-side rate limiting (`express-rate-limit`) is overkill for a
  desktop app but add `/api/health` throttling if you ever host this.
- Add `vitest` + a few HTTP integration tests with `supertest`.

### 6.D — Electron packaging end-to-end (~½ day)

1. Source/replace `desktop/build-resources/icon.ico` (the Ford-blue
   shield from the prototype works — export at 256×256).
2. Add the Windows code-signing cert path to
   `electron-builder.json` (or `desktop/package.json` `build` block):
   `"win": { "certificateFile": "...", "certificatePassword": "..." }`.
   Use env vars in CI; never commit cert details.
3. Test the packaged build on a clean Windows VM. Watch the SmartScreen
   reputation banner — it goes away after 1000+ downloads or you can
   shortcut it by buying an EV code-signing cert.
4. Enable auto-update only if connectivity to a corporate update server
   is sanctioned by IT (`electron-updater`). Otherwise leave disabled
   and ship version bumps as fresh installers.

### 6.E — Charts beyond the prototype (~½ day)

Already-designed but not ported:
- **Ranking chart** (`buildIntervalPlot` in `logic.cjs`) — descending
  mean CF per color (PowerBI "Interval plot" style).
- **Plant scorecard** in the filter summary bar when 2+ plants selected
  (mentioned in PROJECT.md §12).

Open ideas worth doing later:
- **PDF/PNG export** of the dashboard view (`html2canvas` + `jspdf`).
- **Per-file metadata panel** showing detected plant/model/row count.
- **Cross-month worst-offenders digest** (a global view, not just the
  current period).

### 6.F — Tests & CI (~½ day)

- Migrate the home-rolled test harness to **Vitest** in each workspace.
- Add **Playwright** e2e tests (`@playwright/test`) that drive the
  packaged Electron app — at minimum: drop an Excel file, confirm the
  ribbon shows PASS counts, open the standards dialog, save an
  override, reload, verify it persisted.
- GitHub Actions matrix: `windows-latest` for the .exe, `ubuntu-latest`
  for unit tests. Sign in CI using GitHub Encrypted Secrets.

## 7. Hard constraints (don't break these)

1. **Status logic is `avg ≥ Min + 2` = PASS / `< Min` = FAIL** — Ford
   target is reference-only. Anyone reverting to "≥ Ford = PASS"
   reintroduces a known false-positive. The relevant tests in
   `shared/test/core.test.cjs` (`statusOf v2: …`) will catch it.
2. **Full-precision means** — never round before status check or mean
   label. Rounding is display-only (`fmtCF`). The dedup path averages
   distinct values at full precision; preserve that.
3. **DBL = Ranger** — store as `'Ranger'`, display as `'DBL'`.
4. **Null-model and null-plant rows are wildcards** in the filter, not
   hidden. Reverting this hides AAT data when the user picks FTM.
5. **`[All]` rows must be dropped** before any calculation. They are
   MES aggregates and double-count.
6. **Backend binds 127.0.0.1 only.** Never `0.0.0.0`. IT security
   relies on this.
7. **No outbound HTTP at runtime.** No CDN, no telemetry, no auto-update
   check unless IT explicitly enables it. Helmet's CSP enforces this.
8. **`asar: true`** in `electron-builder` — keeps the source tree out
   of the installer, makes tampering obvious.

## 8. Known-tricky bits (read before touching)

- **`Plotly.react` purge** — the prototype's `plotInto()` purges before
  `Plotly.react()` when the structural signature changes (chart type,
  colors, trace count). Without it Plotly carries stale axis categories
  across renders. The regression test for this lives at
  `prototype/test/plotly.lifecycle.test.js` (not yet ported to the new
  monorepo; bring it across when you port the chart components).
- **Plant-compare ignores the plant filter** —
  `logic.cjs:filtersForPlantCompare()`. Without this dropping the
  filter, selecting FTM in the sidebar collapses the plant comparison
  to a single series. The behaviour is unit-tested.
- **Schema-2 history migration** — `loadHistory()` accepts both v1
  (flat `{family: {fordH, …}}`) and v2
  (`{families:{}, colors:{}}`) shapes. Don't remove the v1 branch
  until you're sure no plant still has a stored v1 file.
- **2-digit year matcher** — `core.cjs:matchYear()` deliberately
  requires the digits to sit against a letter/underscore, so a file
  index like "`04__June26`" doesn't read "04" as the year 2004.
  There's a test; if you "simplify" the regex, you'll regress it.

## 9. If something is unclear

Read the file. The prototype's `app.js`, `applogic.js`, and `core.js`
are heavily commented — every comment is there because some past
behaviour was confusing enough to deserve one. Trust the comments
before trusting this handoff doc.

Last things last: this app exists to make a paint-quality engineer's
Monday morning shorter. Optimise for "see the problem instantly".
Every UX choice in the prototype's design — the andon ribbon at the
top, the problem-zones digest right below it, click-to-jump from the
digest into the detail card — supports that single user story.
