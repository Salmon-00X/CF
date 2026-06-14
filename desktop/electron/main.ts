/* =========================================================================
 * CF Wavescan Analyzer — Electron main process.
 *
 * Boots an embedded Express backend on a free 127.0.0.1 port, waits for it to
 * be healthy, then opens a hardened BrowserWindow. See Doc/ARCHITECTURE.md
 * (embedding diagram) and Doc/SECURITY.md (Electron checklist).
 *
 * SECURITY: the backend binds 127.0.0.1 only; the renderer is locked down
 * (contextIsolation, sandbox, no nodeIntegration); navigation off
 * 127.0.0.1/file:// is blocked; new windows defer to the OS browser.
 * ========================================================================= */
import { app, BrowserWindow, ipcMain, shell, dialog, session } from 'electron';
import * as path from 'path';
import * as net from 'net';
import * as http from 'http';
import * as os from 'os';
import * as fs from 'fs';
import { spawn, ChildProcess } from 'child_process';

const isDev = !app.isPackaged;
const DEV_RENDERER_URL = 'http://localhost:5173';

let backendProc: ChildProcess | null = null;
let apiPort = 0;
let win: BrowserWindow | null = null;
let isQuiting = false;

/* (a) Find an open 127.0.0.1 port via the net.createServer trick. */
function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address() as net.AddressInfo;
      const port = addr.port;
      srv.close(() => resolve(port));
    });
  });
}

/* DB lives under the user profile: %APPDATA%/CFWavescan/cf-data/cf.sqlite. */
function dbPath(): string {
  const base = app.getPath('appData'); // %APPDATA% on Windows
  const dir = path.join(base, 'CFWavescan', 'cf-data');
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'cf.sqlite');
}

/* (b) Spawn the backend child process with PORT + DB_PATH set. */
function startBackend(port: number): void {
  const env = { ...process.env, PORT: String(port), DB_PATH: dbPath() };

  if (isDev) {
    // dev: run the TypeScript backend through its workspace "start" (ts-node).
    const repoRoot = path.resolve(__dirname, '..', '..');
    const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    backendProc = spawn(npmCmd, ['run', 'start', '--workspace', '@cf-wavescan/backend'], {
      cwd: repoRoot,
      env,
      stdio: 'inherit',
      shell: process.platform === 'win32', // .cmd needs a shell on Windows
    });
  } else {
    // prod: run the compiled server.js with the bundled Electron binary acting
    // as Node (ELECTRON_RUN_AS_NODE) — no separate Node install required.
    const serverJs = path.join(process.resourcesPath, 'backend', 'server.js');
    backendProc = spawn(process.execPath, [serverJs], {
      env: { ...env, ELECTRON_RUN_AS_NODE: '1' },
      stdio: 'inherit',
    });
  }

  backendProc.on('exit', (code) => {
    backendProc = null;
    if (code && code !== 0 && !isQuiting) {
      dialog.showErrorBox('Backend stopped', `The CF Wavescan backend exited unexpectedly (code ${code}).`);
    }
  });
}

/* (c) Poll /api/health every 500ms; reject after 30s. */
function waitForBackend(port: number, timeoutMs = 30000): Promise<void> {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get({ host: '127.0.0.1', port, path: '/api/health', timeout: 1500 }, (res) => {
        if (res.statusCode === 200) {
          res.resume();
          resolve();
        } else {
          res.resume();
          retry();
        }
      });
      req.on('error', retry);
      req.on('timeout', () => {
        req.destroy();
        retry();
      });
    };
    const retry = () => {
      if (Date.now() - started > timeoutMs) reject(new Error('Backend did not become healthy within 30s.'));
      else setTimeout(tick, 500);
    };
    tick();
  });
}

/* (d) Open the hardened BrowserWindow. */
function createWindow(port: number): void {
  win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'CF Wavescan Analyzer',
    backgroundColor: '#f4f6fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // required
      nodeIntegration: false, // required
      sandbox: true, // required
      webSecurity: true, // required
    },
  });

  // Navigation guards (both required by Doc/SECURITY.md).
  win.webContents.on('will-navigate', (event, url) => {
    const ok = url.startsWith('http://127.0.0.1') || url.startsWith('http://localhost') || url.startsWith('file://');
    if (!ok) event.preventDefault();
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL(DEV_RENDERER_URL);
  } else {
    win.loadFile(path.join(process.resourcesPath, 'renderer', 'index.html'));
  }

  win.on('closed', () => {
    win = null;
  });
}

/* In production, enforce the strict CSP via response headers (the bundled app
 * needs no inline/eval). connect-src is scoped to the chosen loopback port. */
function applyProdCsp(port: number): void {
  if (isDev) return;
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; ` +
            `img-src 'self' data: blob:; font-src 'self' data:; ` +
            `connect-src 'self' http://127.0.0.1:${port}; object-src 'none'; frame-ancestors 'none';`,
        ],
      },
    });
  });
}

async function bootstrap(): Promise<void> {
  try {
    apiPort = await getFreePort();
    startBackend(apiPort);
    await waitForBackend(apiPort);
    applyProdCsp(apiPort);
    createWindow(apiPort);
  } catch (err: any) {
    dialog.showErrorBox('CF Wavescan failed to start', String(err?.message || err));
    app.quit();
  }
}

// Single instance — a second launch focuses the existing window.
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) {
      if (win.isMinimized()) win.restore();
      win.focus();
    }
  });

  // IPC bridge surface.
  ipcMain.handle('get-api-base', () => `http://127.0.0.1:${apiPort}`);
  ipcMain.handle('get-version', () => app.getVersion());

  app.whenReady().then(bootstrap);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0 && apiPort) createWindow(apiPort);
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });

  // (e) On quit, SIGTERM the backend child and let it exit.
  app.on('before-quit', () => {
    isQuiting = true;
    if (backendProc) {
      try {
        backendProc.kill('SIGTERM');
      } catch {
        /* noop */
      }
    }
  });
}
