# Backend Reading Tests + ProblemZones Click-to-Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an automated test for the `/api/readings` endpoints and make dashboard problem-zone rows jump to the Data view pre-filtered to that color.

**Architecture:** Extract `createApp()` from `server.ts` so a dependency-light home-grown test can drive the Express app on an ephemeral port + temp DB (no new deps). For the UX, lift a `dataFilter` string into App; a problem-zone click sets it and switches to the Data view, where `ReadingsGrid` seeds its existing text filter from it.

**Tech Stack:** Express + better-sqlite3 + ts-node (backend), React 18 + shadcn (frontend), Electron 33.

## Global Constraints

- **Branch:** `feat/readings-tests-clicktoedit`.
- **No new dependencies** — backend test uses the home-grown harness style of `shared/test/core.test.js` + Node's global `fetch`.
- **Security unchanged:** `server.ts` still binds `127.0.0.1` only; `createApp()` adds no new middleware or routes.
- **No runtime behavior change** from the refactor: the dev/packaged server must boot and serve identically (entry stays `backend/src/server.ts`; esbuild follows the new `./app` import).
- **`initialFilter` must not clobber a user-typed filter:** the grid effect keys ONLY on `initialFilter` changes.
- **`onPick` is optional** on ProblemZones — absent = today's render (no regression).
- **Regression gate:** 15 CFLogic tests stay green; new backend test green; frontend `tsc --noEmit` + `vite build` clean.

---

## File Structure

**New:** `backend/src/app.ts` (builds the Express app, no listen); `backend/test/readings.test.ts` (endpoint test).
**Modified:** `backend/src/server.ts` (thin bootstrap), `backend/package.json` (test script), `frontend/src/App.tsx`, `frontend/src/components/ProblemZones.tsx`, `frontend/src/components/data/DataView.tsx`, `frontend/src/components/data/ReadingsGrid.tsx`.

---

### Task 1: Backend `/api/readings` test (+ createApp refactor)

**Files:**
- Create: `backend/src/app.ts`, `backend/test/readings.test.ts`
- Modify: `backend/src/server.ts`, `backend/package.json`

**Interfaces:**
- Produces: `createApp(): import('express').Express` from `backend/src/app.ts` — the fully-configured app (helmet/CSP, cors, json limit, multer, all `/api` routers, error handler) WITHOUT `listen`.

- [ ] **Step 1: Create `backend/src/app.ts`** (moves everything from server.ts except listen)

```ts
/* =========================================================================
 * createApp — builds the configured Express app (no listen). server.ts
 * bootstraps it; tests import it directly.
 *
 * SECURITY: this module adds NO routes/middleware beyond what server.ts had.
 * The 127.0.0.1 bind lives in server.ts and is the real network boundary.
 * ========================================================================= */
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import multer from 'multer';

import { createImportsRouter } from './routes/imports';
import { monthsRouter } from './routes/months';
import { readingsRouter } from './routes/readings';
import { standardsRouter } from './routes/standards';
import { analysisRouter } from './routes/analysis';

const ALLOWED = /\.(xlsx|xlsm|xls)$/i;

export class UnsupportedFileTypeError extends Error {
  status = 415;
  constructor() {
    super('Only .xlsx, .xlsm, or .xls files are accepted.');
  }
}

export function createApp() {
  const app = express();

  app.use(
    helmet({
      contentSecurityPolicy: {
        useDefaults: true,
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          connectSrc: ["'self'"],
          objectSrc: ["'none'"],
        },
      },
    })
  );
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED.test(file.originalname)) cb(null, true);
      else cb(new UnsupportedFileTypeError());
    },
  });

  app.use('/api', createImportsRouter(upload));
  app.use('/api', monthsRouter);
  app.use('/api', readingsRouter);
  app.use('/api', standardsRouter);
  app.use('/api', analysisRouter);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof UnsupportedFileTypeError) {
      return res.status(415).json({ error: err.message });
    }
    if (err instanceof multer.MulterError) {
      const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      return res.status(status).json({ error: err.message, code: err.code });
    }
    console.error(err);
    return res.status(500).json({ error: 'Internal server error.' });
  });

  return app;
}
```

- [ ] **Step 2: Replace `backend/src/server.ts` with a thin bootstrap**

```ts
/* =========================================================================
 * CF Wavescan backend — bootstrap. App construction lives in ./app
 * (createApp); this file only listens.
 *
 * SECURITY (Doc/SECURITY.md, non-negotiable): binds 127.0.0.1 ONLY. Never
 * change HOST to an all-interfaces or external address.
 * ========================================================================= */
import { createApp } from './app';

const PORT = Number(process.env.PORT) || 4000;
const HOST = '127.0.0.1'; // SECURITY: loopback only — never an external/all-interfaces address

const app = createApp();
app.listen(PORT, HOST, () => {
  console.log(`CF Wavescan backend listening on http://${HOST}:${PORT}`);
});

export { app };
```

- [ ] **Step 3: Write the test `backend/test/readings.test.ts`**

Uses `require` (not `import`) for `../src/app` and `../src/db` so `process.env.DB_PATH` is set BEFORE `db.ts` resolves it (ES imports hoist; require runs in order).

```ts
/* =========================================================================
 * @cf-wavescan/backend — /api/readings endpoint tests.
 * Dependency-light home-grown harness (matches shared/test/core.test.js).
 * Spins createApp() on an ephemeral port over a throwaway temp DB, seeds rows
 * directly via better-sqlite3, then drives PATCH/DELETE over HTTP.
 * Run with: npm -w @cf-wavescan/backend test
 * ========================================================================= */
import path from 'path';
import os from 'os';
import fs from 'fs';

// Point the DB at a throwaway file BEFORE importing the app/db (db.ts reads
// process.env.DB_PATH at module load). require keeps execution ordered.
const DB = path.join(os.tmpdir(), `cf-readings-test-${process.pid}-${Date.now()}.sqlite`);
process.env.DB_PATH = DB;

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { createApp } = require('../src/app');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { db } = require('../src/db');

let passed = 0;
let failed = 0;
const failures: string[] = [];
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    passed++;
    console.log('  ✓ ' + name);
  } else {
    failed++;
    failures.push(name + (detail ? ' — ' + detail : ''));
    console.log('  ✗ ' + name + (detail ? ' — ' + detail : ''));
  }
}

async function main() {
  // --- seed: one file + two readings ---
  const fileInfo = db
    .prepare(
      'INSERT INTO files (filename,month_key,plant,model,row_count,imported_at) VALUES (?,?,?,?,?,?)'
    )
    .run('test.xlsx', '2026-05', 'FTM', 'Ranger', 2, new Date().toISOString());
  const fileId = Number(fileInfo.lastInsertRowid);
  const ins = db.prepare(
    'INSERT INTO readings (file_id,month_key,plant,model,color,family,zone,orient,cf) VALUES (@file_id,@month_key,@plant,@model,@color,@family,@zone,@orient,@cf)'
  );
  const seed = { file_id: fileId, month_key: '2026-05', plant: 'FTM', model: 'Ranger', color: 'Shadow Black', family: 'Blacks', zone: '01 RRHOOD', orient: 'H', cf: 20 };
  const id1 = Number(ins.run(seed).lastInsertRowid);
  const id2 = Number(ins.run({ ...seed, zone: '02 ROOF', cf: 18 }).lastInsertRowid);

  // --- start the app on an ephemeral port ---
  const app = createApp();
  const server = app.listen(0);
  await new Promise<void>((res) => server.on('listening', () => res()));
  const addr = server.address();
  const port = typeof addr === 'object' && addr ? addr.port : 0;
  const base = `http://127.0.0.1:${port}`;
  const J = async (method: string, p: string, body?: any) => {
    const r = await fetch(base + p, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    let j: any = null;
    try {
      j = await r.json();
    } catch {
      /* no body */
    }
    return { status: r.status, json: j };
  };

  // --- PATCH cf ---
  let res = await J('PATCH', `/api/readings/${id1}`, { cf: 12.3 });
  check('PATCH cf -> 200', res.status === 200, 'status ' + res.status);
  check('PATCH cf updates value', !!res.json && res.json.cf === 12.3, JSON.stringify(res.json));

  // --- PATCH color recomputes family ---
  res = await J('PATCH', `/api/readings/${id1}`, { color: 'Arctic White' });
  check('PATCH color -> 200', res.status === 200, 'status ' + res.status);
  check(
    'family recomputed (not the seeded Blacks, non-empty)',
    !!res.json && res.json.color === 'Arctic White' && !!res.json.family && res.json.family !== 'Blacks',
    'family=' + (res.json && res.json.family)
  );

  // --- invalid fields -> 400, no partial write ---
  const invalids: Array<[string, any]> = [
    ['cf:-1', { cf: -1 }],
    ['cf:201', { cf: 201 }],
    ['color empty', { color: '' }],
    ['zone blank', { zone: '  ' }],
    ['orient X', { orient: 'X' }],
    ['model F150', { model: 'F150' }],
    ['plant Narnia', { plant: 'Narnia' }],
  ];
  for (const [label, body] of invalids) {
    const rr = await J('PATCH', `/api/readings/${id2}`, body);
    check(`invalid ${label} -> 400`, rr.status === 400, 'status ' + rr.status);
  }
  const row2 = db.prepare('SELECT cf FROM readings WHERE id=?').get(id2) as any;
  check('no partial write on invalid (cf still 18)', !!row2 && row2.cf === 18, 'cf=' + (row2 && row2.cf));

  // --- no editable fields / bad ids ---
  check('PATCH {} -> 400', (await J('PATCH', `/api/readings/${id2}`, {})).status === 400);
  check('PATCH /readings/abc -> 400', (await J('PATCH', '/api/readings/abc', { cf: 10 })).status === 400);
  check('PATCH /readings/0 -> 400', (await J('PATCH', '/api/readings/0', { cf: 10 })).status === 400);
  check('PATCH missing id -> 404', (await J('PATCH', '/api/readings/999999', { cf: 10 })).status === 404);

  // --- DELETE ---
  res = await J('DELETE', `/api/readings/${id2}`);
  check(
    'DELETE -> 200 {ok,deleted:1,fileId}',
    res.status === 200 && !!res.json && res.json.deleted === 1 && res.json.fileId === fileId,
    JSON.stringify(res.json)
  );
  check('row deleted', !db.prepare('SELECT 1 FROM readings WHERE id=?').get(id2));
  const f = db.prepare('SELECT row_count FROM files WHERE id=?').get(fileId) as any;
  check('file row_count decremented to 1', !!f && f.row_count === 1, 'row_count=' + (f && f.row_count));
  check('DELETE /readings/abc -> 400', (await J('DELETE', '/api/readings/abc')).status === 400);
  check('DELETE missing id -> 404', (await J('DELETE', '/api/readings/999999')).status === 404);

  // --- teardown ---
  await new Promise<void>((res) => server.close(() => res()));
  try {
    db.close();
  } catch {
    /* ignore */
  }
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      fs.rmSync(DB + suffix, { force: true });
    } catch {
      /* ignore */
    }
  }

  console.log(`\nTests: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`);
  if (failed) {
    console.log('FAILURES:\n' + failures.map((x) => ' - ' + x).join('\n'));
    process.exit(1);
  }
  console.log('All tests passed.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 4: Add the test script to `backend/package.json`**

In `scripts`, add (after `"start"`):
```json
    "test": "ts-node test/readings.test.ts",
```

- [ ] **Step 5: Run the test**

Run: `npm test -w @cf-wavescan/backend`
Expected: every `✓`, final line `All tests passed.`, exit 0. (If `ts-node` ESM/CJS interop fails on the `require`, the fallback is `tsc -p backend/tsconfig.json` then `node backend/dist/test/readings.test.js` — note it in the report.)

- [ ] **Step 6: Confirm the dev server still boots after the refactor**

Run (background, then curl, then kill):
```bash
DB_PATH="$(mktemp -u).sqlite" PORT=4099 npm start -w @cf-wavescan/backend &
# after it logs "listening":
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:4099/api/months   # expect 200
```
Expected: `200`. Kill the server.

- [ ] **Step 7: Commit**

```bash
git add backend/src/app.ts backend/src/server.ts backend/test/readings.test.ts backend/package.json
git commit -m "test(backend): /api/readings endpoint tests + createApp refactor"
```

---

### Task 2: ProblemZones click → Data view, pre-filtered

**Files:**
- Modify: `frontend/src/App.tsx`, `frontend/src/components/ProblemZones.tsx`, `frontend/src/components/data/DataView.tsx`, `frontend/src/components/data/ReadingsGrid.tsx`

**Interfaces:**
- Produces: `ProblemZones` optional prop `onPick?: (color: string) => void`; `DataView`/`ReadingsGrid` optional prop `initialFilter?: string`.

- [ ] **Step 1: App state + wiring (`frontend/src/App.tsx`)**

Add state next to `view`:
```tsx
  const [dataFilter, setDataFilter] = useState('');
```
Change the ProblemZones usage (in the dashboard branch) to:
```tsx
                <ProblemZones
                  history={history}
                  filters={filters}
                  onPick={(c) => {
                    setDataFilter(c);
                    setView('data');
                  }}
                />
```
Change the DataView usage (data branch) to pass the filter:
```tsx
          <DataView history={history} monthKey={filters.monthKey} reload={loadAll} initialFilter={dataFilter} />
```

- [ ] **Step 2: ProblemZones optional onPick (`frontend/src/components/ProblemZones.tsx`)**

Add to `Props`:
```tsx
  onPick?: (color: string) => void;
```
Destructure it: `export default function ProblemZones({ history, filters: S, onPick }: Props) {`
Change the row to be clickable only when `onPick` is provided:
```tsx
                  <TableRow
                    key={i}
                    className={cn(onPick && 'cursor-pointer')}
                    title={onPick ? `Edit ${z.color} in the Data view` : undefined}
                    onClick={onPick ? () => onPick(z.color) : undefined}
                  >
```
(`cn` is already imported in this file.)

- [ ] **Step 3: DataView forwards initialFilter (`frontend/src/components/data/DataView.tsx`)**

Add `initialFilter?: string;` to `Props`, destructure it, and pass it to the grid:
```tsx
      <ReadingsGrid history={history} monthKey={monthKey} reload={reload} initialFilter={initialFilter} />
```

- [ ] **Step 4: ReadingsGrid seeds + syncs the filter (`frontend/src/components/data/ReadingsGrid.tsx`)**

Add `initialFilter?: string;` to `Props` and destructure it in the signature
(`export default function ReadingsGrid({ monthKey, reload, initialFilter }: Props) {`).
Seed the filter state from it:
```tsx
  const [filter, setFilter] = useState(initialFilter ?? '');
```
Add an effect (next to the existing `useEffect` for `api.readings`) that re-applies it ONLY when `initialFilter` changes — so it never clobbers what the user types:
```tsx
  useEffect(() => {
    if (initialFilter !== undefined) setFilter(initialFilter);
  }, [initialFilter]);
```

- [ ] **Step 5: Verify**

Run: `cd frontend && npx tsc --noEmit -p tsconfig.json` → exit 0; `npm run build -w @cf-wavescan/frontend` → succeeds.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/App.tsx frontend/src/components/ProblemZones.tsx frontend/src/components/data/DataView.tsx frontend/src/components/data/ReadingsGrid.tsx
git commit -m "feat(frontend): problem-zone row click opens Data view filtered to that color"
```

---

### Task 3: Verification + desktop build

**Files:** Modify `desktop/package.json` (version).

- [ ] **Step 1: Bump** `2.1.1` → `2.2.0` in `desktop/package.json` (minor: new click-to-edit feature).
- [ ] **Step 2: All tests** — `npm test -w @cf-wavescan/shared` (15 PASS) and `npm test -w @cf-wavescan/backend` (all PASS).
- [ ] **Step 3: Frontend** — `npm run build -w @cf-wavescan/frontend` + `cd frontend && npx tsc --noEmit` clean.
- [ ] **Step 4: Desktop installer** — `npm run dist:win -w @cf-wavescan/desktop` → `desktop/release/CF Wavescan Analyzer Setup 2.2.0.exe`. (This also re-bundles the backend, validating the createApp refactor survives esbuild.)
- [ ] **Step 5: Packaged backend smoke** — run packaged `server.js` under Electron `ELECTRON_RUN_AS_NODE=1` + temp DB/PORT; `GET /api/months` → 200; confirm 127.0.0.1 bind. Kill after.
- [ ] **Step 6: Manual smoke (user)** — on the dashboard, click a FAIL/WARNING problem-zone row → app switches to Data view with the readings grid filtered to that color; edit its CF → back on Dashboard the number reflects it.
- [ ] **Step 7: Commit**

```bash
git add desktop/package.json
git commit -m "chore(desktop): bump to 2.2.0 (problem-zone click-to-edit)"
```

---

## Self-Review

**Spec coverage:** createApp refactor (T1 S1–S2), backend test with all PATCH/DELETE/family/400/404/row_count assertions (T1 S3), no-deps harness + script (T1 S3–S4), dev-boot regression (T1 S6); App dataFilter + onPick wiring (T2 S1), optional onPick no-regression (T2 S2), DataView/ReadingsGrid initialFilter + sync-without-clobber effect (T2 S3–S4); bundle-survives + packaged smoke + version bump (T3). All spec sections mapped.

**Placeholder scan:** every code step is complete; the test file is full; the ts-node fallback is concrete. No `TBD`/vague-error stubs.

**Type consistency:** `createApp()` returns the Express app used by both `server.ts` and the test; `onPick?: (color: string) => void` and `initialFilter?: string` are declared in T2 and consumed exactly as named; the grid's existing `filter`/`setFilter` are reused (not renamed). The test seeds columns matching `db.ts` schema (`file_id,month_key,plant,model,color,family,zone,orient,cf`).
