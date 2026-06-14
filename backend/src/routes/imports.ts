/* =========================================================================
 * /api/imports — upload, stage, commit, discard
 *
 * Thin route: parse via CFCore.parseSheets() (shared), stage the result in
 * pending_imports, and on commit persist to files + readings. No analytics or
 * status logic here.
 * ========================================================================= */
import { Router, Request, Response } from 'express';
import type { Multer } from 'multer';
import * as XLSX from 'xlsx';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../db';
import { CFCore } from '../shared';

interface StagedPayload {
  filename: string;
  records: any[];
  warnings: string[];
  modelDetected: string | null;
  plantDetected: string | null;
  monthHint: { year: number; month: number; key: string } | null;
}

/** Build the sheet array CFCore.parseSheets expects from a workbook buffer. */
function sheetsFromBuffer(buf: Buffer) {
  const wb = XLSX.read(buf, { type: 'buffer' });
  return wb.SheetNames.map((name) => ({
    name,
    rows: XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null }),
  }));
}

export function createImportsRouter(upload: Multer): Router {
  const router = Router();

  // POST /api/imports — upload one .xlsx, parse, stage.
  router.post('/imports', upload.single('file'), (req: Request, res: Response) => {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded (field name must be "file").' });
    }
    let parsed;
    try {
      const sheets = sheetsFromBuffer(req.file.buffer);
      parsed = CFCore.parseSheets(sheets, { filename: req.file.originalname });
    } catch (err: any) {
      return res.status(422).json({ error: 'Failed to parse workbook: ' + (err && err.message) });
    }

    const mh = CFCore.monthFromFilename(req.file.originalname);
    const monthHint = mh
      ? { year: mh.year, month: mh.month, key: CFCore.monthKey(mh.year, mh.month) }
      : null;

    const id = uuidv4();
    const payload: StagedPayload = {
      filename: req.file.originalname,
      records: parsed.records,
      warnings: parsed.warnings || [],
      modelDetected: parsed.modelDetected || null,
      plantDetected: parsed.plantDetected || null,
      monthHint,
    };
    db.prepare(
      'INSERT INTO pending_imports (id, filename, payload, created_at) VALUES (?, ?, ?, ?)'
    ).run(id, req.file.originalname, JSON.stringify(payload), new Date().toISOString());

    return res.json({
      id,
      rowCount: parsed.records.length,
      warnings: parsed.warnings || [],
      monthHint,
      modelDetected: parsed.modelDetected || null,
      plantDetected: parsed.plantDetected || null,
    });
  });

  // POST /api/imports/:id/commit — persist a staged import to files + readings.
  router.post('/imports/:id/commit', (req: Request, res: Response) => {
    const row = db.prepare('SELECT payload FROM pending_imports WHERE id = ?').get(req.params.id) as
      | { payload: string }
      | undefined;
    if (!row) return res.status(404).json({ error: 'Staged import not found.' });

    const staged: StagedPayload = JSON.parse(row.payload);
    const monthKey: string | null =
      (req.body && req.body.monthKey) || (staged.monthHint && staged.monthHint.key) || null;
    if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return res
        .status(400)
        .json({ error: 'monthKey (YYYY-MM) is required — none detected from filename.' });
    }
    // An explicit model choice (not "auto") overrides every row; otherwise each
    // row keeps its own detected model, falling back to the file-level one.
    const modelOverride: string | null =
      req.body && req.body.model && req.body.model !== 'auto' ? req.body.model : null;
    const modelFallback: string | null =
      staged.modelDetected === 'Ranger' || staged.modelDetected === 'Raptor' ? staged.modelDetected : null;
    const model: string | null = modelOverride || modelFallback;
    const plant: string | null = (req.body && req.body.plant) || staged.plantDetected || null;

    const commit = db.transaction(() => {
      // Retention rule: a re-upload of the same file in the same month replaces
      // its old rows. Deleting the files row cascades to its readings.
      db.prepare('DELETE FROM files WHERE filename = ? AND month_key = ?').run(
        staged.filename,
        monthKey
      );

      const fileInfo = db
        .prepare(
          `INSERT INTO files (filename, month_key, plant, model, row_count, imported_at)
           VALUES (?, ?, ?, ?, ?, ?)`
        )
        .run(staged.filename, monthKey, plant, model, staged.records.length, new Date().toISOString());
      const fileId = Number(fileInfo.lastInsertRowid);

      const insert = db.prepare(
        `INSERT INTO readings (file_id, month_key, plant, model, color, family, zone, orient, cf)
         VALUES (@file_id, @month_key, @plant, @model, @color, @family, @zone, @orient, @cf)`
      );
      let added = 0;
      for (const r of staged.records) {
        insert.run({
          file_id: fileId,
          month_key: monthKey,
          plant: r.plant ?? plant ?? null,
          model: modelOverride ?? r.model ?? modelFallback ?? null,
          color: r.color,
          family: r.family,
          zone: r.zone,
          orient: r.orient,
          cf: r.cf,
        });
        added++;
      }
      db.prepare('DELETE FROM pending_imports WHERE id = ?').run(req.params.id);
      return added;
    });

    const added = commit();
    return res.json({ ok: true, monthKey, added });
  });

  // DELETE /api/imports/:id — discard a staged import.
  router.delete('/imports/:id', (req: Request, res: Response) => {
    const info = db.prepare('DELETE FROM pending_imports WHERE id = ?').run(req.params.id);
    return res.json({ ok: true, discarded: info.changes });
  });

  return router;
}
