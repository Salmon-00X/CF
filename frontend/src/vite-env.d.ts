/// <reference types="vite/client" />

// The shared engines are UMD CommonJS without type declarations (native-TS
// migration is Phase 6). They are consumed through src/lib/shared.ts.
declare module '@cf-wavescan/shared/src/core.js';
declare module '@cf-wavescan/shared/src/logic.js';
declare module 'plotly.js-dist-min';

// Electron preload bridge (present only in the packaged desktop app).
interface Window {
  cf?: {
    getApiBase?: () => Promise<string> | string;
    getVersion?: () => Promise<string> | string;
  };
  CFCore?: any;
  CFLogic?: any;
}
