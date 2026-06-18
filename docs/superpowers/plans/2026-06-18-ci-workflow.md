# CI Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions workflow that runs all 52 tests + the frontend build/typecheck on every push to `main` and every PR.

**Architecture:** One workflow file, single ubuntu job, Node 24. `npm ci` installs the workspaces (better-sqlite3 uses its Linux prebuild), then the three test suites + `vite build` + `tsc --noEmit` run. Correctness is confirmed locally (the exact commands) before the first push; GitHub reports the authoritative result.

**Tech Stack:** GitHub Actions, Node 24, npm workspaces, Vitest, ts-node.

## Global Constraints

- **Branch:** `feat/ci`.
- **Scope:** Linux test gate only — no Electron `dist:win` in CI.
- **Runner/Node:** `ubuntu-latest`, Node `24`.
- **Triggers:** `push` to `main` + `pull_request`.
- **No production code changes; no version bump; no secrets.**
- Commands the workflow runs must match what passes locally (verified in Task 1).

---

## File Structure

**New:** `.github/workflows/ci.yml` (the only deliverable).
**Modified:** none.

---

### Task 1: Create the CI workflow + verify its commands locally

**Files:** Create `.github/workflows/ci.yml`.

**Interfaces:** none (config file).

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

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

      - name: Install (all workspaces)
        run: npm ci

      - name: Shared engine tests
        run: npm test --workspace @cf-wavescan/shared

      - name: Backend API tests
        run: npm test --workspace @cf-wavescan/backend

      - name: Frontend tests
        run: npm test --workspace @cf-wavescan/frontend

      - name: Frontend build
        run: npm run --workspace @cf-wavescan/frontend build

      - name: Frontend typecheck
        run: npx tsc --noEmit -p tsconfig.json
        working-directory: frontend
```

- [ ] **Step 2: YAML sanity-check**

Run (pyyaml is the cleanest; if it is not installed the command prints the hint and you fall
back to the command dry-run in Step 3, which is the substantive check):
```bash
python -c "import yaml; yaml.safe_load(open('.github/workflows/ci.yml')); print('YAML OK')" 2>&1 || echo "pyyaml unavailable — rely on Step 3 dry-run + GitHub's parse on push"
```
Expected: `YAML OK` (or the fallback note).

- [ ] **Step 3: Dry-run the exact CI command sequence locally**

Run each command the workflow runs (skip `npm ci` — deps are already installed on the dev
machine; the suites/build/typecheck are what can actually fail):
```bash
npm test --workspace @cf-wavescan/shared
npm test --workspace @cf-wavescan/backend
npm test --workspace @cf-wavescan/frontend
npm run --workspace @cf-wavescan/frontend build
cd frontend && npx tsc --noEmit -p tsconfig.json && cd ..
```
Expected: shared `All tests passed.` (15); backend `All tests passed.` (22); frontend
`Tests 15 passed (15)`; build `✓ built`; tsc exits 0. If any fails, the workflow would fail
too — fix the command in the YAML (not the test) and re-run.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: GitHub Actions — run all test suites + frontend build on push/PR"
```

---

### Task 2: Confirm the live run (after the branch is pushed)

This task runs at branch completion (finishing-a-development-branch pushes `feat/ci`, which
triggers the workflow), not during local execution.

- [ ] **Step 1:** After `feat/ci` (or `main`, post-merge) is pushed, confirm the **CI** workflow
  run succeeded. With `gh` available:
  ```bash
  GH_TOKEN="$(printf 'protocol=https\nhost=github.com\n\n' | git credential fill 2>/dev/null | grep '^password=' | cut -d= -f2-)" \
    "/c/Program Files/GitHub CLI/gh.exe" run list --workflow CI --limit 1
  ```
  Expected: the latest run is `completed` / `success`. (Or check the Actions tab in the browser.)
- [ ] **Step 2:** If the run fails for an environment reason that the local dry-run could not
  catch (e.g. `npm ci` native build, a runner-only path issue), fix `ci.yml` and push again;
  do not weaken the test commands.

---

## Self-Review

**Spec coverage:** workflow file with the exact triggers/runner/Node and the 5 run-steps (Task 1
Step 1); YAML check (Task 1 Step 2); local command dry-run = the spec's §3 verification (Task 1
Step 3); live-run confirmation = the "authoritative green check after push" (Task 2). Out-of-
scope items (Electron build, release automation, badge) are correctly absent. No production code
touched.

**Placeholder scan:** the YAML is complete and final (the spec's earlier `npx --workspace tsc`
mistake is corrected here to `working-directory: frontend` + `npx tsc -p tsconfig.json`); the
verification steps carry exact commands + expected output. No TBDs.

**Type consistency:** workspace names match `package.json` (`@cf-wavescan/shared|backend|
frontend`); the typecheck step's `working-directory: frontend` + `-p tsconfig.json` matches how
`tsc` is invoked locally throughout this project; the `gh` path + token-reuse mirror the exact
method used to publish the v2.3.0 release.
