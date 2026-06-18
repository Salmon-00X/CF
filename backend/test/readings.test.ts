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
  const seed = {
    file_id: fileId,
    month_key: '2026-05',
    plant: 'FTM',
    model: 'Ranger',
    color: 'Shadow Black',
    family: 'Blacks',
    zone: '01 RRHOOD',
    orient: 'H',
    cf: 20,
  };
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
    ['cf:0', { cf: 0 }],
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
