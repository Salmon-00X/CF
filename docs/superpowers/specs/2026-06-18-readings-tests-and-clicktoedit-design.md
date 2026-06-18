# Backend Reading Tests + ProblemZones Click-to-Edit — Design Spec

**Date:** 2026-06-18
**Branch:** `feat/readings-tests-clicktoedit` (created at implementation)
**Status:** Approved design, pending spec review
**Milestone:** Post-v2.1.1 enhancements

---

## Context

Both redesign slices shipped (v2.0.0 shell, v2.1.0/2.1.1 data management + editing).
Two follow-ups remain from the slice-2 final review and the user's roadmap pick:

1. The new `PATCH`/`DELETE /api/readings/:id` endpoints are only curl-smoked — they need
   a repeatable automated test.
2. ProblemZones rows used to open a (now-deleted) detail card; the click was removed. Re-purpose
   it: clicking a problem zone should jump to the Data view, pre-filtered to that color, so the
   user goes straight from "what's wrong" to fixing it.

These are independent and small. One spec, one plan, two task groups.

### Decisions locked (from brainstorming)

- **Test tooling:** match the repo's dependency-light home-grown harness (`shared/test/core.test.js`
  style) — a plain script with a pass/fail counter, run via `ts-node`. **No new deps** (no
  vitest/supertest/jest).
- **Testability refactor:** extract `createApp()` (build app, mount routers, NO `listen`) from
  `server.ts`. Justified, minimal — it's the seam the test needs.
- **Click-to-edit:** reuse the readings grid's existing text filter (matches color/zone). Clicking a
  problem zone pre-fills it with the color and switches to the Data view. No new filter logic, no
  Position/model coupling.

---

## A. Backend tests for `/api/readings`

### A1. Testability refactor (`backend/src/server.ts` → + `backend/src/app.ts`)

- New `backend/src/app.ts` exports `createApp(): express.Express` — everything currently in
  `server.ts` *except* `app.listen(...)`: helmet/CSP, cors, json limit, multer setup, the four
  router mounts (incl. `readingsRouter`), and the error handler. Returns the configured `app`.
- `backend/src/server.ts` becomes the bootstrap: `import { createApp } from './app'`, then
  `createApp().listen(PORT, HOST, …)` with the same `HOST='127.0.0.1'` and log line.
- **No behavior change** at runtime: the packaged/dev server is byte-equivalent in behavior; only the
  module boundary moves. `backend/scripts/bundle.js` still bundles `server.ts` as the entry (verify
  the bundle still includes `app.ts` — esbuild follows the import).

### A2. Test file (`backend/test/readings.test.ts`)

- Home-grown harness mirroring `shared/test/core.test.js`: `test(name, fn)`, `passed`/`failed`
  counters, non-zero exit on failure, summary line.
- **Isolation:** set `process.env.DB_PATH` to a fresh temp file (e.g. `os.tmpdir()` + unique name)
  **before** importing `../src/app` (so `db.ts` resolves the temp DB). Remove the temp file at the
  end. Each run starts clean.
- **Server:** `createApp().listen(0)` to get an ephemeral port; derive the base URL from
  `server.address()`; `await` readiness; `server.close()` at the end. Use global `fetch` (Node 24).
- **Seed:** insert one `files` row and a couple `readings` rows directly via the imported `db`
  (prepared statements), capturing their ids — no Excel import needed.
- **Assertions:**
  - `PATCH cf` → 200, body `cf` updated.
  - `PATCH color` (to a color in a different family) → 200, `family` recomputed via the same path
    (`CFCore.normalizeColor`), not the old family.
  - `PATCH` each invalid field (`cf:-1`, `cf:201`, `color:''`, `zone:'  '`, `orient:'X'`,
    `model:'F150'`, `plant:'Narnia'`) → 400, and the row is unchanged (no partial write).
  - `PATCH {}` (no editable fields) → 400.
  - `PATCH` non-integer id (`/readings/abc`) and id `0` → 400.
  - `PATCH` valid-but-missing id (`/readings/999999`) → 404.
  - `DELETE` a reading → 200 `{ok,deleted:1,fileId}`; the row is gone; the file's `row_count`
    decreased by 1.
  - `DELETE` non-integer id → 400; missing id → 404.
- `backend/package.json`: add `"test": "ts-node test/readings.test.ts"`.

## B. ProblemZones → click to edit

### B1. App state + wiring (`frontend/src/App.tsx`)

- Add `const [dataFilter, setDataFilter] = useState('')`.
- Pass to ProblemZones a handler: `onPick={(color) => { setDataFilter(color); setView('data'); }}`.
- Pass `initialFilter={dataFilter}` into `<DataView ... />` (data view branch).
- The Dashboard/Data switch in the topbar still works; switching to Data manually shows the last
  `dataFilter` (or empty).

### B2. ProblemZones (`frontend/src/components/ProblemZones.tsx`)

- Re-add an optional `onPick?: (color: string) => void` prop. When present, rows get
  `cursor-pointer`, a `title` ("Edit {color} in the Data view"), and `onClick={() => onPick(z.color)}`.
- When absent, rows render exactly as now (no regression for any other caller — there is only one).

### B3. DataView + ReadingsGrid (`frontend/src/components/data/*`)

- `DataView` takes `initialFilter?: string` and forwards it to `ReadingsGrid`.
- `ReadingsGrid` takes `initialFilter?: string`. Seed the existing `filter` state from it, and sync
  when it changes via an effect keyed on `initialFilter` (so a second click on a different color
  updates the box). The user can still edit/clear the filter afterward.

## Data flow

ProblemZones (dashboard) → `onPick(color)` → App sets `dataFilter` + `view='data'` → DataView passes
`initialFilter` → ReadingsGrid pre-fills its filter box → the month's readings narrow to that color,
editable immediately. All existing edit/delete + `reload()` behavior is unchanged.

## Error handling / edge cases

- Clicking a problem zone for a color while on a month whose grid has that color → filter shows the
  rows. If somehow no matching rows, the grid simply shows "0 rows" with the filter text visible
  (user can clear it). No error path.
- `initialFilter` empty string → grid behaves exactly as today (unfiltered).

## Testing

- **Backend:** `npm test -w @cf-wavescan/backend` (new) → all assertions pass; harness exits non-zero
  on any failure.
- **Engines:** 15 CFLogic tests stay green.
- **Frontend:** `tsc --noEmit` + `vite build` clean; manual smoke — click a FAIL row on the dashboard,
  land in Data view filtered to that color, edit its CF, see the dashboard update.

## File structure

**New:** `backend/src/app.ts`, `backend/test/readings.test.ts`.
**Modified:** `backend/src/server.ts` (thin bootstrap), `backend/package.json` (test script),
`frontend/src/App.tsx`, `frontend/src/components/ProblemZones.tsx`,
`frontend/src/components/data/DataView.tsx`, `frontend/src/components/data/ReadingsGrid.tsx`.

## Risks

- **Bundle entry:** moving app construction into `app.ts` must not break `backend/scripts/bundle.js`
  (entry stays `server.ts`; esbuild follows the `./app` import). Verified by rebuilding the desktop
  bundle / packaged-backend health in the verification step.
- **ts-node test under the monorepo:** the test imports `../src/app`, which transitively requires the
  shared engines by subpath (same as `server.ts` already does) — should resolve identically under
  `ts-node`. If `ts-node` ESM/CJS interop bites, fall back to running the test against a pre-built
  `tsc` output, documented in the plan.
- **`initialFilter` sync:** an effect that overwrites the user's manually-typed filter on every render
  would be a bug; it must key only on `initialFilter` changes (not run on unrelated re-renders).
