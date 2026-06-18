/* =========================================================================
 * /api/readings — edit (PATCH) and delete (DELETE) a single reading.
 * Editable fields only: cf, color, zone, orient, model, plant. month_key /
 * file_id are structural and not editable. family is recomputed from color.
 * ========================================================================= */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { CFCore } from '../shared';

export const readingsRouter = Router();

const PLANTS: string[] = CFCore.PLANTS || [];
const EDITABLE = ['cf', 'color', 'zone', 'orient', 'model', 'plant'] as const;

/** Returns an error message if invalid, else null. */
function validateField(field: string, value: any): string | null {
  switch (field) {
    case 'cf':
      return typeof value === 'number' && isFinite(value) && value > 0 && value <= 200
        ? null
        : 'cf must be a number greater than 0 and at most 200';
    case 'color':
      return typeof value === 'string' && value.trim() ? null : 'color must be a non-empty string';
    case 'zone':
      return typeof value === 'string' && value.trim() ? null : 'zone must be a non-empty string';
    case 'orient':
      return value === 'H' || value === 'V' ? null : "orient must be 'H' or 'V'";
    case 'model':
      return value === null || value === 'Ranger' || value === 'Raptor'
        ? null
        : "model must be 'Ranger', 'Raptor', or null";
    case 'plant':
      return value === null || PLANTS.includes(value) ? null : 'plant must be a known plant or null';
    default:
      return 'unknown field';
  }
}

readingsRouter.patch('/readings/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid reading id.' });
  const body = (req.body || {}) as Record<string, any>;
  const provided = EDITABLE.filter((f) => Object.prototype.hasOwnProperty.call(body, f));
  if (!provided.length) return res.status(400).json({ error: 'No editable fields provided.' });

  for (const f of provided) {
    const msg = validateField(f, body[f]);
    if (msg) return res.status(400).json({ error: msg });
  }

  const existing = db.prepare('SELECT * FROM readings WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Reading not found.' });

  const updates: Record<string, any> = {};
  for (const f of provided) updates[f] = body[f];
  if ('color' in updates) updates.color = String(updates.color).trim();
  if ('zone' in updates) updates.zone = String(updates.zone).trim();
  if ('color' in updates) {
    const norm = CFCore.normalizeColor(updates.color);
    updates.family = (norm && norm.family) || '';
  }

  // Column names come only from the EDITABLE whitelist (+ literal 'family'),
  // never from user keys — safe to interpolate. Values are bound params.
  const cols = Object.keys(updates);
  const setClause = cols.map((c) => `${c} = @${c}`).join(', ');
  db.prepare(`UPDATE readings SET ${setClause} WHERE id = @id`).run({ ...updates, id });

  res.json(db.prepare('SELECT * FROM readings WHERE id = ?').get(id));
});

readingsRouter.delete('/readings/:id', (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: 'Invalid reading id.' });
  const row = db.prepare('SELECT file_id FROM readings WHERE id = ?').get(id) as
    | { file_id: number }
    | undefined;
  if (!row) return res.status(404).json({ error: 'Reading not found.' });

  const tx = db.transaction(() => {
    db.prepare('DELETE FROM readings WHERE id = ?').run(id);
    db.prepare('UPDATE files SET row_count = MAX(row_count - 1, 0) WHERE id = ?').run(row.file_id);
  });
  tx();

  res.json({ ok: true, deleted: 1, fileId: row.file_id });
});
