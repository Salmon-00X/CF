/* =========================================================================
 * /api/months — month rollup, raw readings, file list, and file deletion.
 * ========================================================================= */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { CFLogic } from '../shared';

export const monthsRouter = Router();

// GET /api/months — distinct months with reading counts.
monthsRouter.get('/months', (_req: Request, res: Response) => {
  const rows = db
    .prepare(
      `SELECT month_key, COUNT(*) AS count
         FROM readings
        GROUP BY month_key
        ORDER BY month_key`
    )
    .all() as Array<{ month_key: string; count: number }>;
  res.json(
    rows.map((r) => ({
      monthKey: r.month_key,
      count: r.count,
      label: CFLogic.keyToLabel(r.month_key),
    }))
  );
});

// GET /api/months/:key/readings — raw rows for one month.
monthsRouter.get('/months/:key/readings', (req: Request, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM readings WHERE month_key = ?')
    .all(req.params.key);
  res.json(rows);
});

// GET /api/months/:key/files — files imported into one month.
monthsRouter.get('/months/:key/files', (req: Request, res: Response) => {
  const rows = db
    .prepare('SELECT * FROM files WHERE month_key = ? ORDER BY imported_at DESC')
    .all(req.params.key);
  res.json(rows);
});

// DELETE /api/files/:id — drop a file's rows (cascades to readings).
monthsRouter.delete('/files/:id', (req: Request, res: Response) => {
  const info = db.prepare('DELETE FROM files WHERE id = ?').run(req.params.id);
  res.json({ ok: true, deleted: info.changes });
});
