/* =========================================================================
 * CF Wavescan backend — Express bootstrap.
 *
 * SECURITY (Doc/SECURITY.md, non-negotiable): the server binds 127.0.0.1
 * ONLY. It must never be reachable from the LAN. Do not change the host in
 * app.listen() to an all-interfaces or any external address.
 * ========================================================================= */
import express, { Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import multer from 'multer';

import { createImportsRouter } from './routes/imports';
import { monthsRouter } from './routes/months';
import { readingsRouter } from './routes/readings';
import { standardsRouter } from './routes/standards';
import { analysisRouter } from './routes/analysis';

const PORT = Number(process.env.PORT) || 4000;
const HOST = '127.0.0.1'; // SECURITY: loopback only — never an external/all-interfaces address

const app = express();

// --- security headers / CSP ------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
  })
);

// Renderer talks to us same-origin (Vite proxy in dev, file:// → 127.0.0.1 in
// prod). cors stays permissive but the bind address is the real boundary.
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// --- file upload (multer) --------------------------------------------------
const ALLOWED = /\.(xlsx|xlsm|xls)$/i;

class UnsupportedFileTypeError extends Error {
  status = 415;
  constructor() {
    super('Only .xlsx, .xlsm, or .xls files are accepted.');
  }
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
  fileFilter: (_req, file, cb) => {
    if (ALLOWED.test(file.originalname)) cb(null, true);
    else cb(new UnsupportedFileTypeError());
  },
});

// --- routes (all under /api) ----------------------------------------------
app.use('/api', createImportsRouter(upload));
app.use('/api', monthsRouter);
app.use('/api', readingsRouter);
app.use('/api', standardsRouter);
app.use('/api', analysisRouter);

// --- error handling --------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof UnsupportedFileTypeError) {
    return res.status(415).json({ error: err.message });
  }
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    return res.status(status).json({ error: err.message, code: err.code });
  }
  console.error(err);
  return res.status(500).json({ error: 'Internal server error.' });
});

app.listen(PORT, HOST, () => {
  console.log(`CF Wavescan backend listening on http://${HOST}:${PORT}`);
});

export { app };
