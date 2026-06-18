# CI Workflow (GitHub Actions) — Design Spec

**Date:** 2026-06-18
**Branch:** `feat/ci` (created at implementation)
**Status:** Approved design, pending spec review
**Milestone:** Post-v2.3.0 quality / automation

---

## Context

The repo has 52 automated tests (15 engine, 22 backend, 15 frontend) but no automation
running them — regressions are only caught when someone runs the suites locally. This slice
adds a single GitHub Actions workflow that runs all three test suites plus the frontend
typecheck and production build on every push to `main` and every pull request, giving a
required-style green check. The Electron installer build is intentionally out of CI (Windows-
only, slow); the user chose a fast Linux test gate.

### Decisions locked (from brainstorming)

- **Scope:** Linux test gate — run shared + backend + frontend tests, frontend `tsc` + `vite
  build`. No Electron packaging in CI.
- **Runner/Node:** `ubuntu-latest`, Node **24** (matches local v24.13.0), single job.
- **Triggers:** `push` to `main` + `pull_request`.
- **No production code changes; no version bump.**

---

## 1. Workflow file — `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
          cache: 'npm'
      - run: npm ci
      - run: npm test --workspace @cf-wavescan/shared
      - run: npm test --workspace @cf-wavescan/backend
      - run: npm test --workspace @cf-wavescan/frontend
      - run: npm run --workspace @cf-wavescan/frontend build
      - name: Frontend typecheck
        run: npx tsc --noEmit -p tsconfig.json
        working-directory: frontend
```

(The exact step ordering/flags are finalized in the plan; the typecheck step's invocation is
verified locally to run from the repo root correctly.)

### Why each piece
- **`npm ci`** (root): installs every workspace from the committed lockfile. `better-sqlite3`
  `^12.10.1` has a Linux x64 prebuilt binary, so this does not compile native code (no
  build-essential/python needed on the runner).
- **shared test** → the home-grown engine harness (`node test/core.test.js`), 15 tests.
- **backend test** → `ts-node test/readings.test.ts`: spins `createApp()` on an ephemeral port
  over a temp SQLite DB and drives PATCH/DELETE over `fetch` (global in Node 24). 22 tests.
- **frontend test** → `vitest run` (jsdom), 15 tests.
- **frontend build** → `vite build` (catches bundling regressions, e.g. the require-is-not-
  defined class).
- **frontend tsc** → `--noEmit` typecheck (vite build alone does not typecheck).

## 2. Constraints / correctness

- **Lockfile in sync:** `npm ci` fails if `package-lock.json` is out of sync — it is current
  (verified by the local dry run in §3).
- **No secrets:** the workflow needs none (no publish, no external calls; backend tests bind
  `127.0.0.1` on the runner).
- **No network at test time** beyond `npm ci`'s registry fetch — the backend test seeds its DB
  directly and talks to its own loopback server; the frontend tests mock the API boundary.
- **Determinism:** temp DB per backend run (pid+timestamp), `vitest run` (non-watch).

## 3. Verification (local, before first push)

Since Actions can't be triggered from here, the plan verifies the workflow's correctness two
ways:
1. **YAML parse-check** — parse `.github/workflows/ci.yml` (e.g. `node -e` with a YAML
   parser, or `python -c "import yaml,sys;yaml.safe_load(open(...))"`) to catch syntax errors.
2. **Command dry-run** — run the exact test/build/typecheck commands the workflow runs on this
   machine and confirm all pass (`npm ci` itself is exercised by normal dev installs; the four
   suite/build/tsc commands are what can actually fail). The authoritative green check appears
   on GitHub after the first push.

## 4. Out of scope

- Electron installer build / packaging in CI (Windows runner) — excluded by the chosen scope.
- Release automation / artifact upload (that was the separate "CI + release automation" option,
  not chosen).
- Caching beyond npm (no Vite/build cache); matrix across Node versions or OSes.
- A README status badge — offered separately; only added if the user opts in (no README exists
  to host one today).

## File structure

**New:** `.github/workflows/ci.yml`.
**Modified:** none (no production code, no version bump). Optionally a new `README.md` only if
the user later opts into a status badge.

## Risks

- **`npm ci` native build on the runner:** if for any reason no `better-sqlite3` prebuilt
  matches the runner's Node 24, `npm ci` would try to compile (needs python/build tools).
  Mitigation: Node 24 is within `better-sqlite3` v12's prebuilt matrix; `ubuntu-latest` ships
  the build toolchain anyway, so it would still succeed, just slower. Confirmed acceptable.
- **`tsc` step path:** running the typecheck from the repo root must point at the frontend
  tsconfig; the plan pins the exact working-directory/flags and verifies locally so the CI step
  matches what passes on the dev machine.
- **Flaky jsdom/Radix in headless CI:** the frontend tests already pass headlessly here (jsdom
  is headless by nature); the setup polyfills are environment-independent. Low risk.
