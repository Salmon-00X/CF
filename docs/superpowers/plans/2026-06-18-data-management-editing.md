# Data Management & In-App Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users delete imported files and edit/delete individual readings spreadsheet-style in a dedicated Data view, fixing mistakes without re-uploading Excel.

**Architecture:** Two new backend endpoints (`PATCH`/`DELETE /api/readings/:id`) on a new router; typed client wrappers; a top-level "Data" view (toggled in the topbar) with a files panel and an inline-editable readings grid. Every mutation calls the App's existing `loadAll()` so the dashboard reflects edits. CFCore/CFLogic engines and the DB schema are unchanged.

**Tech Stack:** Express + better-sqlite3 (backend), React 18 + shadcn/ui + Tailwind v4 (frontend), Electron 33 packaging.

## Global Constraints

_Every task implicitly includes these. Exact values from the spec + verified code._

- **Branch:** all work on `redesign/v2-data`.
- **Security (non-negotiable):** backend binds `127.0.0.1` only; **prepared statements only** (no string-built SQL with user values); no new outbound calls.
- **Not editable:** `month_key`, `file_id`, `id` (month/file assignment is structural). Editable fields ONLY: `cf, color, zone, orient, model, plant`.
- **`family` is derived, never client-set:** when `color` changes the server recomputes `family = CFCore.normalizeColor(color).family || ''` (same path as import).
- **Validation (server is source of truth; reject 400 on any violation, no partial write):**
  `cf` finite number `>0` and `<=200`; `color` non-empty trimmed string; `zone` non-empty trimmed string; `orient` exactly `'H'`|`'V'`; `model` `'Ranger'`|`'Raptor'`|`null`; `plant` in `CFCore.PLANTS` or `null`.
- **Refresh model:** mutations call `loadAll()` (no optimistic local cache).
- **Radix Select:** no empty-string item values — the Plant "none" option uses a sentinel mapped to `null`.
- **Regression gate:** 15 CFLogic tests stay green (`npm test -w @cf-wavescan/shared`); `vite build` + `tsc --noEmit` clean on the frontend.
- **No backend test harness exists** → backend verification is a headless `curl` smoke (Task 1).

---

## File Structure

**New:**
- `backend/src/routes/readings.ts` — PATCH + DELETE readings endpoints
- `frontend/src/components/data/DataView.tsx` — Data view orchestrator
- `frontend/src/components/data/FilesPanel.tsx` — files list + delete
- `frontend/src/components/data/ReadingsGrid.tsx` — editable readings table
- `frontend/src/components/ui/alert-dialog.tsx` — generated shadcn primitive

**Modified:**
- `backend/src/server.ts` — mount `readingsRouter`
- `frontend/src/lib/api.ts` — `updateReading`, `deleteReading` wrappers
- `frontend/src/App.tsx` — `view` state; render DataView vs dashboard
- `frontend/src/components/shell/AppTopbar.tsx` — `Dashboard | Data` switch
- `desktop/package.json` — version bump (Task 5)

**Testing note:** backend logic is verified by curl smoke (no harness). The frontend grid logic is thin (controlled inputs + fetch + reload); verified by build/tsc + manual smoke. CFLogic engines untouched (15 tests still cover them).

---

### Task 1: Backend readings endpoints + client wrappers

**Files:**
- Create: `backend/src/routes/readings.ts`
- Modify: `backend/src/server.ts:14-16` (import), `backend/src/server.ts:63-66` (mount)
- Modify: `frontend/src/lib/api.ts` (add two wrappers)

**Interfaces:**
- Produces (backend): `PATCH /api/readings/:id` → returns the full updated reading row; `DELETE /api/readings/:id` → `{ ok, deleted, fileId }`.
- Produces (client): `api.updateReading(id: number, patch)` → `Reading`; `api.deleteReading(id: number)` → `{ ok; deleted; fileId }`.

- [ ] **Step 1: Create `backend/src/routes/readings.ts`**

```ts
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
        : 'cf must be a number between 0 and 200';
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
```

- [ ] **Step 2: Mount the router in `backend/src/server.ts`**

Add import beside the others (after line 14):
```ts
import { readingsRouter } from './routes/readings';
```
Add mount beside the others (after `app.use('/api', monthsRouter);`):
```ts
app.use('/api', readingsRouter);
```

- [ ] **Step 3: Add client wrappers in `frontend/src/lib/api.ts`**

Inside the `api` object, after the `deleteFile` line:
```ts
  updateReading: (
    id: number,
    patch: Partial<Pick<Reading, 'cf' | 'color' | 'zone' | 'orient' | 'model' | 'plant'>>
  ) =>
    req<Reading>(`/api/readings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    }),
  deleteReading: (id: number) =>
    req<{ ok: boolean; deleted: number; fileId: number }>(`/api/readings/${id}`, { method: 'DELETE' }),
```

- [ ] **Step 4: Headless curl smoke (no backend test harness)**

Run a dev backend on a fresh DB, import the sample workbook, then exercise PATCH/DELETE:
```bash
cd "C:/Users/Salmon/Desktop/Claude workspace/CF"
T="C:/Users/Salmon/.claude/jobs/e3a361a6/tmp"; rm -f "$T/cf-edit.sqlite"
DB_PATH="$T/cf-edit.sqlite" PORT=4055 npm start -w @cf-wavescan/backend &   # run in background
# wait for "listening", then:
SID=$(curl -s -F "file=@Data/05. May26 CF data.xlsx" http://127.0.0.1:4055/api/imports | python -c "import sys,json;print(json.load(sys.stdin)['id'])")
MK=$(curl -s -X POST -H 'Content-Type: application/json' -d "{\"monthKey\":\"2026-05\",\"model\":\"auto\",\"plant\":null}" http://127.0.0.1:4055/api/imports/$SID/commit | python -c "import sys,json;print(json.load(sys.stdin)['monthKey'])")
RID=$(curl -s "http://127.0.0.1:4055/api/months/$MK/readings" | python -c "import sys,json;print(json.load(sys.stdin)[0]['id'])")
echo "PATCH cf:"; curl -s -X PATCH -H 'Content-Type: application/json' -d '{"cf":12.3}' http://127.0.0.1:4055/api/readings/$RID
echo; echo "PATCH color (family should recompute):"; curl -s -X PATCH -H 'Content-Type: application/json' -d '{"color":"Arctic White"}' http://127.0.0.1:4055/api/readings/$RID
echo; echo "PATCH invalid (expect 400):"; curl -s -o /dev/null -w "%{http_code}\n" -X PATCH -H 'Content-Type: application/json' -d '{"cf":-5}' http://127.0.0.1:4055/api/readings/$RID
echo "DELETE (expect ok + fileId):"; curl -s -X DELETE http://127.0.0.1:4055/api/readings/$RID
echo; echo "404 check:"; curl -s -o /dev/null -w "%{http_code}\n" -X PATCH -H 'Content-Type: application/json' -d '{"cf":10}' http://127.0.0.1:4055/api/readings/$RID
```
Expected: PATCH cf returns the row with `"cf":12.3`; PATCH color returns updated `color` + a recomputed non-empty `family`; invalid → `400`; DELETE → `{"ok":true,"deleted":1,"fileId":...}`; second PATCH on the deleted id → `404`. Kill the dev backend after.

- [ ] **Step 5: Commit**

```bash
git add backend/src/routes/readings.ts backend/src/server.ts frontend/src/lib/api.ts
git commit -m "feat(backend): PATCH/DELETE /api/readings/:id + client wrappers"
```

---

### Task 2: View switch + Data view scaffold + alert-dialog primitive

**Files:**
- Create: `frontend/src/components/data/DataView.tsx`
- Create: `frontend/src/components/ui/alert-dialog.tsx` (generated)
- Modify: `frontend/src/components/shell/AppTopbar.tsx`, `frontend/src/App.tsx`

**Interfaces:**
- Produces: `AppTopbar` gains props `view: 'dashboard'|'data'` and `onViewChange: (v) => void`; `DataView` takes `{ history: History; monthKey: string|null; reload: () => Promise<unknown> }` and renders placeholders for FilesPanel/ReadingsGrid (filled in Tasks 3–4).

- [ ] **Step 1: Add the alert-dialog primitive**

```bash
cd frontend && npx shadcn@latest add alert-dialog --yes
```

- [ ] **Step 2: Add the view switch to `AppTopbar.tsx`**

Add to the `Props` interface:
```ts
  view: 'dashboard' | 'data';
  onViewChange: (v: 'dashboard' | 'data') => void;
```
Render a segmented switch right after the `<Separator orientation="vertical" .../>` (before the brand block), so it sits at the left of the bar:
```tsx
      <div className="flex rounded-md border bg-background p-0.5">
        {(['dashboard', 'data'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={p.view === v}
            onClick={() => p.onViewChange(v)}
            className={
              'rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ' +
              (p.view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted')
            }
          >
            {v}
          </button>
        ))}
      </div>
```
(`p` is the props object — this component already destructures via `p.`.)

- [ ] **Step 3: Create `frontend/src/components/data/DataView.tsx` (scaffold)**

```tsx
/* Data view — file management + spreadsheet-style reading editing. */
import type { History } from '../../lib/select';
import FilesPanel from './FilesPanel';
import ReadingsGrid from './ReadingsGrid';

interface Props {
  history: History;
  monthKey: string | null;
  reload: () => Promise<unknown>;
}

export default function DataView({ history, monthKey, reload }: Props) {
  const month = monthKey ? history.months[monthKey] : null;
  if (!monthKey || !month) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        No month selected. Import data or pick a month in the top bar.
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <FilesPanel monthKey={monthKey} files={month.files} reload={reload} />
      <ReadingsGrid history={history} monthKey={monthKey} reload={reload} />
    </div>
  );
}
```

- [ ] **Step 4: Wire view state in `App.tsx`**

Add state near the other `useState` calls:
```ts
  const [view, setView] = useState<'dashboard' | 'data'>('dashboard');
```
Add `import DataView from './components/data/DataView';` with the other component imports.
Pass the two new props into BOTH `<AppTopbar .../>` usages (the `topbar` const): add `view={view}` and `onViewChange={setView}`.
In the ready-state return, render the Data view OR the dashboard content inside `AppShell`:
```tsx
      <AppShell
        topbar={topbar}
        sidebar={<AppSidebar history={history} filters={filters} update={update} onReset={reset} />}
      >
        {view === 'data' ? (
          <DataView history={history} monthKey={filters.monthKey} reload={loadAll} />
        ) : (
          <>
            <DropZone hasData={hasData} onFile={onFile} />
            {hasData && (
              <>
                <AndonRibbon history={history} filters={filters} />
                <ProblemZones history={history} filters={filters} onPickColor={(c) => update({ detailColor: c })} />
                <ChartCards history={history} filters={filters} />
              </>
            )}
          </>
        )}
      </AppShell>
```

- [ ] **Step 5: Verify build (FilesPanel/ReadingsGrid exist as stubs from Tasks 3–4 — create empty default-export stubs first so this compiles)**

Create minimal stubs so Task 2 builds independently:
`frontend/src/components/data/FilesPanel.tsx`:
```tsx
export default function FilesPanel(_: { monthKey: string; files: string[]; reload: () => Promise<unknown> }) {
  return null;
}
```
`frontend/src/components/data/ReadingsGrid.tsx`:
```tsx
import type { History } from '../../lib/select';
export default function ReadingsGrid(_: { history: History; monthKey: string; reload: () => Promise<unknown> }) {
  return null;
}
```
Run: `npm run build -w @cf-wavescan/frontend` → succeeds; `cd frontend && npx tsc --noEmit` → exit 0.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/data frontend/src/components/ui/alert-dialog.tsx frontend/src/components/shell/AppTopbar.tsx frontend/src/App.tsx frontend/package.json package-lock.json
git commit -m "feat(frontend): Data view scaffold + Dashboard/Data switch + alert-dialog"
```

---

### Task 3: FilesPanel — list + delete files

**Files:**
- Modify: `frontend/src/components/data/FilesPanel.tsx` (replace stub)

**Interfaces:**
- Consumes: `api.files(monthKey)` → `FileRow[]`; `api.deleteFile(id)`; `reload()` from props.
- Props: `{ monthKey: string; files: string[]; reload: () => Promise<unknown> }` (the `files` string list is unused for rendering — full rows are fetched; keep the prop for the signature DataView passes).

- [ ] **Step 1: Implement FilesPanel**

```tsx
/* FilesPanel — files imported into the selected month, with delete. */
import { useEffect, useState } from 'react';
import { api, type FileRow } from '../../lib/api';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

interface Props {
  monthKey: string;
  files: string[];
  reload: () => Promise<unknown>;
}

export default function FilesPanel({ monthKey, reload }: Props) {
  const [rows, setRows] = useState<FileRow[]>([]);

  useEffect(() => {
    api.files(monthKey).then(setRows).catch((e) => toast.error('Could not load files: ' + e.message));
  }, [monthKey]);

  async function del(f: FileRow) {
    try {
      await api.deleteFile(f.id);
      toast.success(`Deleted ${f.filename} (${f.row_count} readings).`);
      await reload();
      setRows((r) => r.filter((x) => x.id !== f.id));
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message);
    }
  }

  return (
    <Card>
      <CardHeader><CardTitle className="text-base">Imported files</CardTitle></CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files for this month.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File</TableHead><TableHead>Plant</TableHead><TableHead>Model</TableHead>
                <TableHead className="text-right">Rows</TableHead><TableHead>Imported</TableHead><TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.filename}</TableCell>
                  <TableCell>{f.plant || '—'}</TableCell>
                  <TableCell>{f.model || '—'}</TableCell>
                  <TableCell className="text-right tabular-nums">{f.row_count}</TableCell>
                  <TableCell className="text-muted-foreground">{new Date(f.imported_at).toLocaleString()}</TableCell>
                  <TableCell className="text-right">
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="size-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete this file?</AlertDialogTitle>
                          <AlertDialogDescription>
                            “{f.filename}” and its {f.row_count} readings will be removed permanently.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction onClick={() => del(f)}>Delete</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify** — `npm run build -w @cf-wavescan/frontend` succeeds; `cd frontend && npx tsc --noEmit` exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/data/FilesPanel.tsx
git commit -m "feat(frontend): FilesPanel — list + delete imported files"
```

---

### Task 4: ReadingsGrid — spreadsheet-style editing + delete row

**Files:**
- Modify: `frontend/src/components/data/ReadingsGrid.tsx` (replace stub)

**Interfaces:**
- Consumes: `api.readings(monthKey)` → `Reading[]`; `api.updateReading(id, patch)`; `api.deleteReading(id)`; `reload()`; `CFCore.COLOR_FAMILY`, `CFCore.PLANTS` via `../../lib/shared`.
- Props: `{ history: History; monthKey: string; reload: () => Promise<unknown> }`.

- [ ] **Step 1: Implement ReadingsGrid with inline EditableCell**

```tsx
/* ReadingsGrid — all readings for the month, edited spreadsheet-style.
   Editable: color (Select → family recomputes server-side), zone (text),
   position (H/V), model (DBL/Raptor), plant (Select), cf (number).
   Click a cell to edit; Enter/blur commits (PATCH); Esc cancels. */
import { useEffect, useMemo, useState } from 'react';
import { api, type Reading } from '../../lib/api';
import { CFCore } from '../../lib/shared';
import type { History } from '../../lib/select';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Trash2 } from 'lucide-react';

const PLANT_NONE = '__none__';
const fieldCls =
  'h-8 w-full rounded border border-input bg-background px-1.5 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring';

interface Props {
  history: History;
  monthKey: string;
  reload: () => Promise<unknown>;
}

type Field = 'color' | 'zone' | 'orient' | 'model' | 'plant' | 'cf';

export default function ReadingsGrid({ history, monthKey, reload }: Props) {
  const [rows, setRows] = useState<Reading[]>([]);
  const [filter, setFilter] = useState('');
  const [editing, setEditing] = useState<{ id: number; field: Field } | null>(null);

  useEffect(() => {
    api.readings(monthKey).then(setRows).catch((e) => toast.error('Could not load readings: ' + e.message));
  }, [monthKey]);

  const knownColors = useMemo(() => {
    const set = new Set<string>();
    Object.keys(CFCore.COLOR_FAMILY || {}).forEach((k) =>
      set.add(k.replace(/\b[a-z]/g, (c) => c.toUpperCase()))
    );
    rows.forEach((r) => set.add(r.color));
    return Array.from(set).sort();
  }, [rows]);
  const plants: string[] = CFCore.PLANTS || [];

  const shown = rows.filter((r) => {
    const q = filter.trim().toLowerCase();
    return !q || r.color.toLowerCase().includes(q) || r.zone.toLowerCase().includes(q);
  });

  async function commit(id: number, patch: Partial<Reading>) {
    try {
      const updated = await api.updateReading(id, patch as any);
      setRows((rs) => rs.map((r) => (r.id === id ? updated : r)));
      setEditing(null);
      toast.success('Reading updated.');
      reload();
    } catch (e: any) {
      toast.error('Edit rejected: ' + e.message); // cell stays in edit
    }
  }

  async function del(r: Reading) {
    try {
      await api.deleteReading(r.id!);
      setRows((rs) => rs.filter((x) => x.id !== r.id));
      toast.success('Reading deleted.');
      reload();
    } catch (e: any) {
      toast.error('Delete failed: ' + e.message);
    }
  }

  function isEditing(id: number, field: Field) {
    return editing?.id === id && editing.field === field;
  }

  /** A display cell that turns into the right editor on click. */
  function Cell({ r, field }: { r: Reading; field: Field }) {
    const editingHere = isEditing(r.id!, field);
    if (!editingHere) {
      const display =
        field === 'orient' ? (r.orient === 'H' ? 'Horizontal' : 'Vertical') :
        field === 'model' ? (r.model ? CFCore.modelLabel(r.model) : '—') :
        field === 'plant' ? (r.plant || '—') :
        field === 'cf' ? CFCore.fmtCF(r.cf) :
        (r as any)[field];
      return (
        <button
          type="button"
          className="block w-full cursor-pointer rounded px-1 py-0.5 text-left hover:bg-muted"
          onClick={() => setEditing({ id: r.id!, field })}
        >
          {display}
        </button>
      );
    }
    // Editors. Each commits on change/Enter/blur, cancels on Esc.
    const cancel = () => setEditing(null);
    if (field === 'cf' || field === 'zone') {
      return (
        <Input
          autoFocus
          defaultValue={field === 'cf' ? String(r.cf) : r.zone}
          type={field === 'cf' ? 'number' : 'text'}
          step={field === 'cf' ? '0.1' : undefined}
          className="h-8"
          onKeyDown={(e) => {
            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
            if (e.key === 'Escape') cancel();
          }}
          onBlur={(e) => {
            const v = e.target.value;
            if (field === 'cf') {
              const n = Number(v);
              if (!isFinite(n) || n <= 0 || n > 200) { toast.error('CF must be 0–200.'); cancel(); return; }
              if (n === r.cf) return cancel();
              commit(r.id!, { cf: n });
            } else {
              const z = v.trim();
              if (!z) { toast.error('Checkzone cannot be empty.'); cancel(); return; }
              if (z === r.zone) return cancel();
              commit(r.id!, { zone: z });
            }
          }}
        />
      );
    }
    // Select-style editors (native select for simplicity + no empty-value pitfalls).
    if (field === 'orient') {
      return (
        <select autoFocus className={fieldCls} defaultValue={r.orient}
          onBlur={cancel}
          onChange={(e) => e.target.value !== r.orient && commit(r.id!, { orient: e.target.value as 'H' | 'V' })}>
          <option value="H">Horizontal</option><option value="V">Vertical</option>
        </select>
      );
    }
    if (field === 'model') {
      return (
        <select autoFocus className={fieldCls} defaultValue={r.model ?? ''}
          onBlur={cancel}
          onChange={(e) => commit(r.id!, { model: (e.target.value || null) as any })}>
          <option value="Ranger">DBL (Ranger)</option><option value="Raptor">Raptor</option>
        </select>
      );
    }
    if (field === 'plant') {
      return (
        <select autoFocus className={fieldCls} defaultValue={r.plant ?? PLANT_NONE}
          onBlur={cancel}
          onChange={(e) => commit(r.id!, { plant: (e.target.value === PLANT_NONE ? null : e.target.value) as any })}>
          <option value={PLANT_NONE}>— none —</option>
          {plants.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>
      );
    }
    // color
    return (
      <select autoFocus className={fieldCls} defaultValue={r.color}
        onBlur={cancel}
        onChange={(e) => e.target.value !== r.color && commit(r.id!, { color: e.target.value })}>
        {knownColors.map((c) => <option key={c} value={c}>{c}</option>)}
      </select>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-3">
        <CardTitle className="text-base">Readings — {CFCore.keyToLabel ? CFCore.keyToLabel(monthKey) : monthKey}</CardTitle>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{shown.length} rows</span>
          <Input placeholder="Filter color / zone…" value={filter} onChange={(e) => setFilter(e.target.value)} className="h-8 w-44" />
        </div>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="text-sm text-muted-foreground">No readings for this month.</p>
        ) : (
          <div className="max-h-[60vh] overflow-auto rounded-md border">
            <Table>
              <TableHeader className="sticky top-0 bg-card">
                <TableRow>
                  <TableHead>Color</TableHead><TableHead>Family</TableHead><TableHead>Checkzone</TableHead>
                  <TableHead>Position</TableHead><TableHead>Model</TableHead><TableHead>Plant</TableHead>
                  <TableHead className="text-right">CF</TableHead><TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="p-1"><Cell r={r} field="color" /></TableCell>
                    <TableCell className="text-muted-foreground">{r.family || '—'}</TableCell>
                    <TableCell className="p-1"><Cell r={r} field="zone" /></TableCell>
                    <TableCell className="p-1"><Cell r={r} field="orient" /></TableCell>
                    <TableCell className="p-1"><Cell r={r} field="model" /></TableCell>
                    <TableCell className="p-1"><Cell r={r} field="plant" /></TableCell>
                    <TableCell className="p-1 text-right tabular-nums"><Cell r={r} field="cf" /></TableCell>
                    <TableCell className="text-right">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="size-8 text-muted-foreground hover:text-destructive">
                            <Trash2 className="size-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete this reading?</AlertDialogTitle>
                            <AlertDialogDescription>
                              {r.color} · {r.zone} · {r.orient} · CF {CFCore.fmtCF(r.cf)} will be removed.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => del(r)}>Delete</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 2: Verify** — `npm run build -w @cf-wavescan/frontend` succeeds; `cd frontend && npx tsc --noEmit` exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/data/ReadingsGrid.tsx
git commit -m "feat(frontend): ReadingsGrid — spreadsheet-style reading editing + delete"
```

---

### Task 5: Full verification + desktop build

**Files:** Modify `desktop/package.json` (version), none else.

- [ ] **Step 1: Bump desktop version** `2.0.0` → `2.1.0` in `desktop/package.json` (minor: additive data-management feature).
- [ ] **Step 2: Shared tests** — `npm test -w @cf-wavescan/shared` → 15 PASS.
- [ ] **Step 3: Frontend build + typecheck** — `npm run build -w @cf-wavescan/frontend` succeeds; `cd frontend && npx tsc --noEmit` exit 0.
- [ ] **Step 4: Desktop installer** — `npm run dist:win -w @cf-wavescan/desktop` → `desktop/release/CF Wavescan Analyzer Setup 2.1.0.exe`.
- [ ] **Step 5: Packaged backend smoke** — run packaged `server.js` under Electron with `ELECTRON_RUN_AS_NODE=1` + a temp `DB_PATH`/`PORT`; hit `/api/health` (expect `{ok:true}`); confirm it binds `127.0.0.1`.
- [ ] **Step 6: Manual smoke (user, GUI)** — launch `win-unpacked`: switch to **Data**; delete a file (confirm prompt); edit a CF cell (Enter saves, dashboard updates); edit a Color cell (Family column updates); change Plant/Model/Position; delete a row; back to **Dashboard** → numbers reflect the edits.
- [ ] **Step 7: Commit**

```bash
git add desktop/package.json
git commit -m "chore(desktop): bump to 2.1.0 for data management + editing"
```

---

## Self-Review

**Spec coverage:** delete files (T3), edit row fields cf/color/zone/orient/model/plant (T4), family recompute on color (T1 backend + shown in T4), delete rows (T4 + T1 backend), dedicated Data view + topbar switch (T2), validation table (T1 `validateField`), 127.0.0.1 + prepared SQL (T1), refresh via `loadAll` (T2 wiring + T3/T4 `reload()`), alert-dialog confirms (T2 add, T3/T4 use), Radix empty-value sentinel (T4 `PLANT_NONE`), verification incl. curl smoke + desktop build (T1, T5). All spec sections mapped. Manual-add explicitly excluded.

**Placeholder scan:** every code step carries full code; the curl smoke gives exact commands + expected outputs; no `TBD`/"handle errors" stubs. The Task-2 stubs are intentional throwaways replaced in Tasks 3–4 (called out explicitly).

**Type consistency:** `api.updateReading(id, patch)`/`api.deleteReading(id)` signatures defined in T1 and consumed verbatim in T3/T4; `Field` union in T4 matches the editable set; `DataView` prop shape (`history`,`monthKey`,`reload`) matches the App call in T2 and the FilesPanel/ReadingsGrid props in T3/T4; backend returns the full updated `Reading` (T1) which T4 swaps into `rows`.
