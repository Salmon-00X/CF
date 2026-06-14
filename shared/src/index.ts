/* =========================================================================
 * @cf-wavescan/shared — package entry point
 *
 * Re-exports the parser/analytics engine (CFCore), the app-logic layer
 * (CFLogic), and all shared types. core.js and logic.js are the prototype
 * engines ported verbatim; they are plain CommonJS without type declarations
 * yet (Phase 6.A migrates them to native TS), so they are surfaced through
 * require() until then.
 * ========================================================================= */

export * from './types';

// Ambient require so this file type-checks standalone (shared has no
// @types/node yet). Removed once core/logic become native TS modules.
declare function require(id: string): any;

export const CFCore = require('./core.js');
export const CFLogic = require('./logic.js');
