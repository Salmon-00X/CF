/* =========================================================================
 * /api/analysis — andon summary, month-over-month deltas, and health.
 *
 * All status decisions flow through the shared engines (CFLogic.summarize /
 * problemZones / momDeltas → CFCore.analyze → CFCore.statusOf). Status is
 * never recomputed here.
 * ========================================================================= */
import { Router, Request, Response } from 'express';
import { db } from '../db';
import { getStandards } from '../db';
import { CFLogic } from '../shared';

export const analysisRouter = Router();

/** Build a CFLogic filters object from query params (?plant=FTM,AAT&model=Ranger). */
function filtersFromQuery(q: any) {
  const filters: any = {};
  if (q.plant) {
    const list = String(q.plant)
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    if (list.length) {
      filters.plants = {};
      list.forEach((p) => (filters.plants[p] = true));
    }
  }
  if (q.model && q.model !== 'Both') filters.model = String(q.model);
  return filters;
}

/** Parse ?period=2026-05,2026-06 into validated month keys. */
function periodKeys(q: any): string[] {
  return String(q.period || '')
    .split(',')
    .map((s) => s.trim())
    .filter((k) => /^\d{4}-\d{2}$/.test(k));
}

function readingsForMonths(keys: string[]): any[] {
  if (!keys.length) return [];
  const placeholders = keys.map(() => '?').join(',');
  return db
    .prepare(`SELECT * FROM readings WHERE month_key IN (${placeholders})`)
    .all(...keys);
}

/** Reconstruct a minimal history object (months → records) for CFLogic. */
function buildHistory(standards: any) {
  const history = CFLogic.newHistory();
  history.standards = standards;
  const monthKeys = (
    db.prepare('SELECT DISTINCT month_key FROM readings ORDER BY month_key').all() as Array<{
      month_key: string;
    }>
  ).map((r) => r.month_key);
  for (const key of monthKeys) {
    const records = db.prepare('SELECT * FROM readings WHERE month_key = ?').all(key);
    history.months[key] = { label: CFLogic.keyToLabel(key), files: [], records };
  }
  return history;
}

// GET /api/health — polled by Electron on startup.
analysisRouter.get('/health', (_req: Request, res: Response) => {
  res.json({ ok: true, version: '1.0.0' });
});

// GET /api/analysis/summary?period=2026-05&plant=FTM
analysisRouter.get('/analysis/summary', (req: Request, res: Response) => {
  const standards = getStandards();
  const keys = periodKeys(req.query);
  const filters = filtersFromQuery(req.query);

  const pool = readingsForMonths(keys);
  const records = CFLogic.filterRecords(pool, filters);

  const summary = CFLogic.summarize(records, standards);
  const ribbon = {
    pass: summary.byStatus.PASS.length,
    warn: summary.byStatus.WARNING.length,
    fail: summary.byStatus.FAIL.length,
  };

  const pz = CFLogic.problemZones(records, standards, 12);

  let chartData: any = { H: null, V: null };
  try {
    chartData = {
      H: CFLogic.buildOrientPlot(records, standards, 'H', {}),
      V: CFLogic.buildOrientPlot(records, standards, 'V', {}),
    };
  } catch {
    /* charts are non-critical; ribbon + zones still return */
  }

  res.json({ period: keys, ribbon, problemZones: pz.list, chartData });
});

// GET /api/analysis/mom?month=2026-05
analysisRouter.get('/analysis/mom', (req: Request, res: Response) => {
  const month = String(req.query.month || '');
  if (!/^\d{4}-\d{2}$/.test(month)) {
    return res.status(400).json({ error: 'month (YYYY-MM) query param is required.' });
  }
  const standards = getStandards();
  const filters = filtersFromQuery(req.query);
  const history = buildHistory(standards);
  const mom = CFLogic.momDeltas(history, month, filters, standards);
  res.json(mom);
});
