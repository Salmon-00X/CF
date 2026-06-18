/* =========================================================================
 * createApp — builds the configured Express app (no listen). server.ts
 * bootstraps it; tests import it directly.
 *
 * SECURITY: this module adds NO routes/middleware beyond what server.ts had.
 * The 127.0.0.1 bind lives in server.ts and is the real network boundary.
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

const ALLOWED = /\.(xlsx|xlsm|xls)$/i;

export class UnsupportedFileTypeError extends Error {
  constructor() {
    super('Only .xlsx, .xlsm, or .xls files are accepted.');
  }
}

export function createApp() {
  const app = express();

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
  app.use(cors());
  app.use(express.json({ limit: '1mb' }));

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 25 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (ALLOWED.test(file.originalname)) cb(null, true);
      else cb(new UnsupportedFileTypeError());
    },
  });

  app.use('/api', createImportsRouter(upload));
  app.use('/api', monthsRouter);
  app.use('/api', readingsRouter);
  app.use('/api', standardsRouter);
  app.use('/api', analysisRouter);

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

  return app;
}
