/* =========================================================================
 * prepare-native.js — fetch the Electron-ABI build of better-sqlite3 into the
 * backend bundle.
 *
 * The bundle ships better-sqlite3 with the Node-ABI prebuild (so it runs under
 * plain `node` in dev). When packaged, the backend is spawned with the bundled
 * Electron binary acting as Node (ELECTRON_RUN_AS_NODE), which uses Electron's
 * ABI — so the native .node must match Electron. We swap it here via
 * prebuild-install. Best-effort: if the prebuild can't be fetched, the
 * installer still builds and we warn loudly.
 * ========================================================================= */
const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const electronVer = require('electron/package.json').version;
const bundleDir = path.resolve(__dirname, '..', '..', 'backend', 'bundle');
const bsqDir = path.join(bundleDir, 'node_modules', 'better-sqlite3');

if (!fs.existsSync(bsqDir)) {
  console.error('prepare-native: backend bundle missing — run `npm -w backend run bundle` first.');
  process.exit(1);
}

console.log(`prepare-native: fetching better-sqlite3 prebuild for Electron ${electronVer} (win32-x64)…`);
try {
  const bin = require.resolve('prebuild-install/bin.js', {
    paths: [bsqDir, bundleDir, path.resolve(__dirname, '..', '..')],
  });
  execFileSync(
    process.execPath,
    [bin, '--runtime=electron', `--target=${electronVer}`, '--arch=x64', '--platform=win32'],
    { cwd: bsqDir, stdio: 'inherit' }
  );
  console.log('prepare-native: Electron-ABI better-sqlite3 installed into the bundle.');
} catch (err) {
  console.warn('───────────────────────────────────────────────────────────────');
  console.warn('prepare-native: WARNING — could not fetch the Electron prebuild for');
  console.warn('better-sqlite3. The installer will still build, but the packaged');
  console.warn('database may fail at runtime until a matching Electron-ABI');
  console.warn('better_sqlite3.node is supplied. Detail: ' + (err && err.message));
  console.warn('───────────────────────────────────────────────────────────────');
}
