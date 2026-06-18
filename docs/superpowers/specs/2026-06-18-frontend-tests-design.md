# Frontend Tests (Vitest + Testing Library) — Design Spec

**Date:** 2026-06-18
**Branch:** `feat/frontend-tests` (created at implementation)
**Status:** Approved design, pending spec review
**Milestone:** Post-v2.3.0 quality

---

## Context

The frontend (`frontend/src`) has no automated tests — the engines (15 CFLogic) and the
backend (22 endpoint) are covered, but the React layer is not. This slice stands up a frontend
test harness and covers the highest-value frontend logic: the editable readings grid's
interaction state machine, the filter sync, the `useFilters` reducer, the topbar's Radix-Select
sentinel mapping, and the problem-zone click handler. Tests mock at the API boundary so they
exercise component behavior, not the network or DB.

### Decisions locked (from brainstorming)

- **Tooling:** Vitest + `@testing-library/react` + `@testing-library/user-event` +
  `@testing-library/jest-dom` + `jsdom`. (User chose the full interaction-test stack.)
- **Config:** add a `test` block to the existing `frontend/vite.config.ts` (vitest reads it),
  `environment: 'jsdom'`, `globals: true`, `setupFiles: ['src/test/setup.ts']`. Script
  `"test": "vitest run"` in `frontend/package.json`.
- **Mock boundary:** mock `../lib/api` and `sonner`; load the real shared engines, falling back
  to mocking the specific `CFCore`/`CFLogic` members used if the UMD/CJS interop trips vitest.
- **Production code:** unchanged, except tiny testability tweaks only if a target proves
  un-mockable (must be flagged, not assumed).

---

## 1. Harness & configuration

- Dev-deps (frontend workspace): `vitest`, `@testing-library/react`, `@testing-library/user-event`,
  `@testing-library/jest-dom`, `jsdom`.
- `frontend/vite.config.ts`: add
  ```ts
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
  ```
  (Keep all existing keys — `base`, `resolve.alias`, `optimizeDeps`, `build.commonjsOptions`,
  the tailwind + react plugins. `css: false` so Tailwind/PostCSS doesn't run during tests.)
- `frontend/src/test/setup.ts`: `import '@testing-library/jest-dom'` + `afterEach(cleanup)`.
- `frontend/package.json` script: `"test": "vitest run"` (and optionally `"test:watch": "vitest"`).
- The `@` alias already resolves via `vite.config.ts` `resolve.alias`; vitest uses it.

## 2. Test files & assertions

`frontend/src/components/data/ReadingsGrid.test.tsx` — the core:
- Renders rows returned by a mocked `api.readings`.
- **Edit CF (success):** click the CF cell → type a valid value → press Enter → asserts
  `api.updateReading` called with `{ cf: <number> }`, the row's displayed CF updates from the
  resolved response, and `reload` was called.
- **Edit CF (server reject):** `api.updateReading` rejects → `toast.error` called AND the cell
  is still an editable input (the "stays in edit on 400" guarantee).
- **Client-invalid CF** (`0`, `999`): blur → `toast.error`, `api.updateReading` NOT called, cell
  stays editable.
- **Esc cancels:** open the CF editor, press Escape → no `api.updateReading`, cell returns to
  display.
- **Color select:** open a color cell, choose a different option → `api.updateReading` called
  with `{ color: <value> }`.
- **Delete row:** click the row's trash → confirm in the AlertDialog → `api.deleteReading`
  called with the id, row removed, `reload` called.
- **Filter:** typing in the filter box narrows visible rows (color/zone match).
- **initialFilter:** passing `initialFilter="Shadow"` pre-filters on mount; changing the prop
  re-applies; typing in the box is NOT overwritten by an unrelated re-render.

`frontend/src/hooks/useFilters.test.ts` (renderHook):
- `update({ model: 'Raptor' })` merges without dropping other keys.
- `reset()` restores `DEFAULT_FILTERS` values (e.g. `model: 'Both'`, `periodPreset: 'single'`).

`frontend/src/components/shell/AppTopbar.test.tsx`:
- Selecting the "All files" item → `onFileChange(null)` (ALL sentinel maps to null).
- Selecting a real file → `onFileChange(<filename>)`.
- (Month select + Import/Standards buttons fire their handlers.)

`frontend/src/components/ProblemZones.test.tsx`:
- With `onPick`: clicking a data row calls `onPick(color)`.
- Without `onPick`: the row has no click handler / pointer affordance (inert).

## 3. Mocking strategy

- `vi.mock('../lib/api')` (path relative to each test) — provide `vi.fn()` implementations
  returning controllable promises so success and rejection paths are both drivable. Reset
  between tests (`vi.clearAllMocks()` in `afterEach`, or `setup.ts`).
- `vi.mock('sonner')` — `toast` as a `vi.fn()` with `.error`/`.success` methods, asserted on.
- Shared engines: import real `@cf-wavescan/shared` (CFCore/CFLogic are pure data + functions).
  If vitest's transform fails on the UMD `require`, add `test.server.deps.inline` for the shared
  package OR mock the specific members the component reads (`CFCore.PLANTS`, `COLOR_FAMILY`,
  `fmtCF`, `modelLabel`; `CFLogic.keyToLabel`) — the plan documents whichever is used.
- Plotly is not exercised (no ChartCards test); jsdom can't render it.

## 4. Verification

- `npm test -w @cf-wavescan/frontend` → all new tests pass, output pristine.
- `npm test -w @cf-wavescan/shared` (15) and `npm test -w @cf-wavescan/backend` (22) still pass
  (untouched).
- `frontend` `tsc --noEmit` + `vite build` still clean (the `test` config block must not break
  the production build).
- No desktop rebuild needed (tests are dev-only; no shipped behavior changes). Version not
  bumped unless production code changed.

## File structure

**New:** `frontend/src/test/setup.ts`; `frontend/src/components/data/ReadingsGrid.test.tsx`;
`frontend/src/hooks/useFilters.test.ts`; `frontend/src/components/shell/AppTopbar.test.tsx`;
`frontend/src/components/ProblemZones.test.tsx`.
**Modified:** `frontend/vite.config.ts` (test block), `frontend/package.json` (deps + script).
**Production source:** unchanged (unless a flagged testability tweak proves necessary).

## Risks

- **UMD/CJS interop in vitest:** the shared engines are CommonJS; vitest's ESM transform may
  need `server.deps.inline` or a member-level mock. Mitigation: documented fallback (mock the
  used members) — keeps tests deterministic regardless.
- **Radix Select in jsdom:** Radix Select uses pointer APIs jsdom doesn't fully implement;
  `user-event` may need `pointerEventsCheck: 0` or the test interacts via keyboard. The grid's
  editable selects are **native `<select>`** (not Radix) — those test cleanly. Only `AppTopbar`
  uses Radix Select; if it's flaky in jsdom, assert via the native change path or fall back to
  testing the `ALL`-sentinel mapping as an extracted pure check. Documented in the plan.
- **`vite.config` test block leaking into prod build:** verify `vite build` still works after
  adding `test` (it should — vitest-only key). Covered in §4.
- **Scope creep:** tests only. No new features; no production refactor beyond a flagged,
  minimal testability tweak.
