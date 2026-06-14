/* =========================================================================
 * Environment shim. In the packaged Electron app the preload exposes
 * window.cf; in the dev browser it's absent, so we fall back to the Vite proxy
 * (empty base → "/api" hits 127.0.0.1:4000) and the health endpoint version.
 * ========================================================================= */

let cachedBase: string | null = null;

export async function getApiBase(): Promise<string> {
  if (cachedBase !== null) return cachedBase;
  const cf = window.cf;
  if (cf && cf.getApiBase) {
    cachedBase = String(await cf.getApiBase());
  } else {
    cachedBase = ''; // same-origin; Vite proxies /api in dev
  }
  return cachedBase;
}

export async function getVersion(): Promise<string> {
  const cf = window.cf;
  if (cf && cf.getVersion) return String(await cf.getVersion());
  return '1.0.0';
}
