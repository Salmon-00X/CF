import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

// In dev, /api is proxied to the backend on 127.0.0.1:4000 (see Doc/ARCHITECTURE
// .md). In the packaged Electron app the renderer reads the real port via
// window.cf.getApiBase().
//
// The shared engines (core.js/logic.js) are UMD/CommonJS. They must be properly
// converted to ESM at build time — otherwise Rollup leaves a literal
// require('./core.js') in the bundle and the renderer dies with
// "require is not defined" (blank screen). We do that by pre-bundling them
// (optimizeDeps.include) and enabling the CommonJS transform for the workspace
// source in the production build (commonjsOptions).
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Relative asset paths so the built index.html works when Electron loads it
  // via file:// (absolute "/assets/..." would resolve to the drive root → blank).
  base: './',
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
  optimizeDeps: {
    include: ['@cf-wavescan/shared/src/core.js', '@cf-wavescan/shared/src/logic.js'],
  },
  build: {
    commonjsOptions: {
      transformMixedEsModules: true,
      include: [/shared[\\/]src[\\/].*\.js$/, /node_modules/],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
});
