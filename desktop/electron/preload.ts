/* =========================================================================
 * Preload — the ONLY bridge exposed to the renderer (Doc/SECURITY.md):
 * window.cf with getApiBase() and getVersion(). Nothing that takes
 * user-controlled input is passed through. Runs in a sandboxed context.
 * ========================================================================= */
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('cf', {
  getApiBase: () => ipcRenderer.invoke('get-api-base'),
  getVersion: () => ipcRenderer.invoke('get-version'),
});
