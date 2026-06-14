import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// In dev, /api is proxied to the backend on 127.0.0.1:4000 (see Doc/ARCHITECTURE
// .md). In the packaged Electron app the renderer reads the real port via
// window.cf.getApiBase(). The shared workspace package is excluded from
// dep-optimization so its UMD engines are served as source and attach to the
// window global (see src/lib/shared.ts).
export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the built index.html works when Electron loads it
  // via file:// (absolute "/assets/..." would resolve to the drive root → blank
  // white screen in the packaged app).
  base: './',
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:4000',
    },
  },
  optimizeDeps: {
    exclude: ['@cf-wavescan/shared'],
  },
});
