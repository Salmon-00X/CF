/* =========================================================================
 * Bridge to @cf-wavescan/shared (CFCore + CFLogic).
 *
 * The engines are UMD/CommonJS modules ported verbatim from the prototype. With
 * Vite's CommonJS transform (see vite.config.ts: optimizeDeps.include +
 * commonjsOptions) they are converted to ESM, exposing the engine object as the
 * module's default export. We unwrap default-or-namespace so both the dev
 * (esbuild) and prod (rollup) interop shapes work.
 * ========================================================================= */
import * as coreMod from '@cf-wavescan/shared/src/core.js';
import * as logicMod from '@cf-wavescan/shared/src/logic.js';

function unwrap(mod: any): any {
  return mod && mod.default ? mod.default : mod;
}

export const CFCore: any = unwrap(coreMod);
export const CFLogic: any = unwrap(logicMod);
