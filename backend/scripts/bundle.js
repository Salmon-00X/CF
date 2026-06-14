/* =========================================================================
 * bundle.js — produce a self-contained prod backend for Electron packaging.
 *
 * esbuild inlines every JS dependency (express, helmet, cors, multer, uuid,
 * xlsx, and the @cf-wavescan/shared engines) into a single server.js. The only
 * native module, better-sqlite3, is kept external and copied alongside so the
 * spawned backend can require it at runtime.
 *
 * Output:  backend/bundle/server.js
 *          backend/bundle/node_modules/better-sqlite3/...
 * ========================================================================= */
const path = require('path');
const fs = require('fs');
const esbuild = require('esbuild');

const ROOT = path.resolve(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'bundle');
const OUT_FILE = path.join(OUT_DIR, 'server.js');

function rmrf(p) {
  fs.rmSync(p, { recursive: true, force: true });
}

function copyDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dst, entry.name);
    if (entry.isDirectory()) copyDir(s, d);
    else if (entry.isSymbolicLink()) fs.symlinkSync(fs.readlinkSync(s), d);
    else fs.copyFileSync(s, d);
  }
}

/** Copy a package and its full runtime-dependency closure into destNodeModules.
 *  better-sqlite3 pulls in `bindings` → `file-uri-to-path`, which are hoisted to
 *  the root node_modules and must travel with it. */
function copyPkgClosure(pkgName, fromPaths, destNodeModules, seen) {
  if (seen.has(pkgName)) return;
  seen.add(pkgName);
  const pkgJsonPath = require.resolve(pkgName + '/package.json', { paths: fromPaths });
  const pkgDir = path.dirname(pkgJsonPath);
  copyDir(pkgDir, path.join(destNodeModules, pkgName));
  const pj = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
  for (const dep of Object.keys(pj.dependencies || {})) {
    copyPkgClosure(dep, fromPaths, destNodeModules, seen);
  }
}

async function main() {
  rmrf(OUT_DIR);
  fs.mkdirSync(OUT_DIR, { recursive: true });

  await esbuild.build({
    entryPoints: [path.join(ROOT, 'src', 'server.ts')],
    bundle: true,
    platform: 'node',
    target: 'node18',
    format: 'cjs',
    outfile: OUT_FILE,
    external: ['better-sqlite3'], // native — shipped beside the bundle
    logLevel: 'info',
    legalComments: 'none',
  });

  // Ship better-sqlite3 + its runtime closure (bindings, file-uri-to-path).
  const destNm = path.join(OUT_DIR, 'node_modules');
  copyPkgClosure('better-sqlite3', [ROOT], destNm, new Set());

  const nativeNode = path.join(destNm, 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node');
  console.log('Bundled backend → ' + OUT_FILE);
  console.log('shipped node_modules: ' + fs.readdirSync(destNm).join(', '));
  console.log('native binary present: ' + fs.existsSync(nativeNode));
}

main().catch((err) => {
  console.error('Backend bundle failed:', err);
  process.exit(1);
});
