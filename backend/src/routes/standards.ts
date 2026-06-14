/* =========================================================================
 * /api/standards — read the active standards, or write a validated set.
 * Storage is a single JSON blob (standards table, id = 1).
 * ========================================================================= */
import { Router, Request, Response } from 'express';
import { getStandards, setStandards } from '../db';

export const standardsRouter = Router();

const STD_KEYS = ['fordH', 'fordV', 'minH', 'minV'] as const;

/** A StandardRow must hold four finite numbers. */
function isStandardRow(v: any): boolean {
  return (
    v &&
    typeof v === 'object' &&
    STD_KEYS.every((k) => typeof v[k] === 'number' && isFinite(v[k]))
  );
}

/** Validate the v2 standards shape: { families: {...}, colors?: {...} }. */
function validateStandards(body: any): string | null {
  if (!body || typeof body !== 'object') return 'Body must be a JSON object.';
  if (!body.families || typeof body.families !== 'object') {
    return 'Missing "families" object.';
  }
  for (const fam of Object.keys(body.families)) {
    if (!isStandardRow(body.families[fam])) {
      return `families["${fam}"] must have numeric fordH, fordV, minH, minV.`;
    }
  }
  if (body.colors !== undefined) {
    if (typeof body.colors !== 'object' || body.colors === null) {
      return '"colors" must be an object when present.';
    }
    for (const col of Object.keys(body.colors)) {
      if (!isStandardRow(body.colors[col])) {
        return `colors["${col}"] must have numeric fordH, fordV, minH, minV.`;
      }
    }
  }
  return null;
}

// GET /api/standards — stored standards, or shared defaults.
standardsRouter.get('/standards', (_req: Request, res: Response) => {
  res.json(getStandards());
});

// PUT /api/standards — validate shape, then upsert.
standardsRouter.put('/standards', (req: Request, res: Response) => {
  const err = validateStandards(req.body);
  if (err) return res.status(400).json({ error: err });
  const clean = { families: req.body.families, colors: req.body.colors || {} };
  setStandards(clean);
  res.json({ ok: true });
});
