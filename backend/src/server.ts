/* =========================================================================
 * CF Wavescan backend — bootstrap. App construction lives in ./app
 * (createApp); this file only listens.
 *
 * SECURITY (Doc/SECURITY.md, non-negotiable): binds 127.0.0.1 ONLY. Never
 * change HOST to an all-interfaces or external address.
 * ========================================================================= */
import { createApp } from './app';

const PORT = Number(process.env.PORT) || 4000;
const HOST = '127.0.0.1'; // SECURITY: loopback only — never an external/all-interfaces address

const app = createApp();
app.listen(PORT, HOST, () => {
  console.log(`CF Wavescan backend listening on http://${HOST}:${PORT}`);
});

export { app };
