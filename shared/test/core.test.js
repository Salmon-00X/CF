/* =========================================================================
 * @cf-wavescan/shared — core engine tests
 *
 * Dependency-light home-grown harness (matches the prototype's style; a real
 * runner — Vitest — arrives in Phase 6.A). Run with: npm -w shared test
 *
 * Tests assert the ACTUAL behaviour of the verbatim-ported core.js. Where the
 * Phase 2 prompt's expected value conflicted with the real (constraint-locked)
 * code, the test follows the code and the divergence is documented inline.
 * ========================================================================= */
'use strict';

const path = require('path');
const XLSX = require('xlsx');
const C = require(path.join(__dirname, '..', 'src', 'core.js'));

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (err) {
    failed++;
    failures.push({ name: name, message: err && err.message });
    console.log('  ✗ ' + name);
    console.log('      ' + (err && err.message));
  }
}

function eq(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error((msg ? msg + ': ' : '') + 'expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

function deep(actual, expected, msg) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    throw new Error((msg ? msg + ': ' : '') + 'expected ' + e + ', got ' + a);
  }
}

function ok(cond, msg) {
  if (!cond) throw new Error(msg || 'expected truthy value');
}

// ---------------------------------------------------------------------------
console.log('\nNORMALIZATION');
// ---------------------------------------------------------------------------
test('normalizeColor("A4 Arctic White BC") -> Arctic White / Light Solids', function () {
  deep(C.normalizeColor('A4 Arctic White BC'), { color: 'Arctic White', family: 'Light Solids' });
});

test('normalizeColor("Aluminum Metallic") -> Aluminium Metallic / Light Metallics', function () {
  deep(C.normalizeColor('Aluminum Metallic'), { color: 'Aluminium Metallic', family: 'Light Metallics' });
});

// The prompt phrased this as `normalizeColor("[All]") -> isAllToken === true`.
// isAllToken is internal to the IIFE (not exported) and core.js is verbatim,
// so we assert the externally-observable contract: an [All] aggregate token is
// rejected as a color (returns null). This is exactly how parseSheets drops
// [All] rows before any calculation (HANDOFF.md §7.5).
test('normalizeColor("[All]") -> null (aggregate token rejected)', function () {
  eq(C.normalizeColor('[All]'), null);
});

// ---------------------------------------------------------------------------
console.log('\nSTATUS RULE v2 (Ford target reference-only; minStd drives status)');
// signature: statusOf(value, ford, minStd). WARNING_BAND = 2, EPS = 1e-9.
//   value <  min          -> FAIL
//   min <= value < min+2  -> WARNING
//   value >= min+2        -> PASS
// ---------------------------------------------------------------------------
test('statusOf(49.9, _, 50) -> FAIL (below minimum)', function () {
  eq(C.statusOf(49.9, 60, 50), 'FAIL');
});

test('statusOf(50.0, _, 50) -> WARNING (at minimum = warning band floor)', function () {
  eq(C.statusOf(50.0, 60, 50), 'WARNING');
});

test('statusOf(51.0, _, 50) -> WARNING (inside [50, 52) band)', function () {
  eq(C.statusOf(51.0, 60, 50), 'WARNING');
});

// PROMPT DIVERGENCE: the prompt expected statusOf(52.0, 50) === "WARNING".
// The verbatim code returns PASS, because the rule is `avg >= min+2 = PASS`
// (min+2 = 52) and the band is the half-open interval [50, 52) which EXCLUDES
// 52 — matching the prompt's own annotations and the locked hard constraint
// (HANDOFF.md §7.1). Test follows the code; core.js is unchanged.
test('statusOf(52.0, _, 50) -> PASS (exactly min+2; boundary is PASS)', function () {
  eq(C.statusOf(52.0, 60, 50), 'PASS');
});

test('statusOf(52.1, _, 50) -> PASS (above min+2)', function () {
  eq(C.statusOf(52.1, 60, 50), 'PASS');
});

test('statusOf ignores the Ford target (reference-only)', function () {
  // Absurd Ford target must not change the verdict — proves it is not used.
  eq(C.statusOf(52.1, 999, 50), 'PASS');
  eq(C.statusOf(49.9, 1, 50), 'FAIL');
});

// ---------------------------------------------------------------------------
console.log('\nMONTH FROM FILENAME (leading index must not be read as year)');
// ---------------------------------------------------------------------------
test('monthFromFilename("05__May26_CF_data.xlsx") -> {year:2026, month:5}', function () {
  deep(C.monthFromFilename('05__May26_CF_data.xlsx'), { year: 2026, month: 5 });
});

test('monthFromFilename("04__June26_CF_data.xlsx") -> {year:2026, month:6} (04 NOT year 2004)', function () {
  deep(C.monthFromFilename('04__June26_CF_data.xlsx'), { year: 2026, month: 6 });
});

test('monthFromFilename("05. May26 CF data.xlsx") -> {year:2026, month:5} (real filename)', function () {
  deep(C.monthFromFilename('05. May26 CF data.xlsx'), { year: 2026, month: 5 });
});

// ---------------------------------------------------------------------------
console.log('\nSMOKE TEST (real workbook: Data/05. May26 CF data.xlsx)');
// ---------------------------------------------------------------------------
const DATA_FILE = path.join(__dirname, '..', '..', 'Data', '05. May26 CF data.xlsx');
let smoke = null;
let smokeError = null;
try {
  const wb = XLSX.readFile(DATA_FILE);
  const sheets = wb.SheetNames.map(function (n) {
    return { name: n, rows: XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: null }) };
  });
  smoke = C.parseSheets(sheets, { filename: '05. May26 CF data.xlsx' });
} catch (err) {
  smokeError = err;
}

test('parseSheets() does not throw on the real workbook', function () {
  if (smokeError) throw smokeError;
  ok(smoke, 'parse produced a result object');
});

test('parseSheets() returns records (length > 0)', function () {
  ok(smoke && smoke.records.length > 0, 'expected records.length > 0, got ' + (smoke && smoke.records.length));
});

test('parsed colors include Arctic White, Code Orange, Shadow Black', function () {
  const colors = new Set((smoke ? smoke.records : []).map(function (r) { return r.color; }));
  ok(colors.has('Arctic White'), 'missing "Arctic White"');
  ok(colors.has('Code Orange'), 'missing "Code Orange"');
  ok(colors.has('Shadow Black'), 'missing "Shadow Black"');
});

// ---------------------------------------------------------------------------
console.log('\n' + '-'.repeat(60));
console.log('Tests: ' + (passed + failed) + ' | Passed: ' + passed + ' | Failed: ' + failed);
if (failed > 0) {
  console.log('\nFAILURES:');
  failures.forEach(function (f) { console.log('  - ' + f.name + '\n    ' + f.message); });
  process.exit(1);
}
console.log('All tests passed.');
