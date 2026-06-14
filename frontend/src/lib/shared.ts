/* =========================================================================
 * Bridge to @cf-wavescan/shared (CFCore + CFLogic).
 *
 * The engines are UMD modules ported verbatim from the prototype. Vite serves
 * the workspace source (optimizeDeps.exclude), so in dev the UMD browser branch
 * runs and attaches CFCore/CFLogic to `window`. In a production rollup build the
 * commonjs interop may instead expose them as the module's default/namespace.
 * We read whichever is present so both dev and build work. core is imported
 * before logic because logic's factory consumes CFCore.
 * ========================================================================= */
import * as coreMod from '@cf-wavescan/shared/src/core.js';
import * as logicMod from '@cf-wavescan/shared/src/logic.js';

const w = window as any;

export const CFCore: any =
  w.CFCore || (coreMod as any).default || coreMod;
export const CFLogic: any =
  w.CFLogic || (logicMod as any).default || logicMod;
