/* =========================================================================
 * Bridge to @cf-wavescan/shared
 *
 * The parser/analytics (CFCore) and app-logic (CFLogic) engines are the
 * prototype code ported verbatim — plain CommonJS without type declarations
 * (native-TS migration is Phase 6). We require them by subpath so ts-node
 * doesn't try to transpile the package's index.ts at runtime. Types are
 * imported type-only (erased at compile time) from the package's types.ts.
 * ========================================================================= */
import type { Reading, Standards, StandardRow, MonthEntry } from '@cf-wavescan/shared/src/types';

// eslint-disable-next-line @typescript-eslint/no-var-requires
export const CFCore: any = require('@cf-wavescan/shared/src/core.js');
// eslint-disable-next-line @typescript-eslint/no-var-requires
export const CFLogic: any = require('@cf-wavescan/shared/src/logic.js');

export type { Reading, Standards, StandardRow, MonthEntry };
