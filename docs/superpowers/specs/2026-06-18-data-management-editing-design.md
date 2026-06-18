# Data Management & In-App Editing — Design Spec (Slice 2)

**Date:** 2026-06-18
**Branch:** `redesign/v2-data` (to be created at implementation)
**Status:** Approved design, pending spec review
**Milestone:** CF Wavescan Analyzer v2 redesign — Slice 2 of 2

---

## Context

Slice 1 shipped the shadcn UI shell (v2.0.0, on `main`). Slice 2 adds the data
management the user asked for: delete imported files, and **edit imported readings
in-app, spreadsheet-style**, so mistakes are fixed without re-uploading the Excel file.

The backend (Express + SQLite) and the CFCore/CFLogic engines are otherwise unchanged.
`readings` columns: `id, file_id, month_key, plant, model, color, family, zone, orient,
cf`. `family` is always derived from `color` (via `CFCore.normalizeColor`), never edited
directly. File delete already exists (`DELETE /api/files/:id`, cascades to readings).

### Decisions locked (from brainstorming)

- **Operations:** delete files, edit row values (Excel-style), delete individual rows.
  **Not** in scope: manual row insertion.
- **Editable fields (user: "choose color, point or anything else"):** `cf`, `color`,
  `zone` (the checkpoint / "point"), `orient` (Position H/V), `model` (DBL=Ranger /
  Raptor), `plant`. `family` is read-only, recomputed from `color`.
- **Surface:** a dedicated top-level **Data view**, switched from the topbar.
- **Refresh model:** any mutation calls the App's `loadAll()` so the dashboard reflects
  edits immediately. No new client state store.

---

## 1. Backend — new endpoints (`backend/src/routes`)

Add to a new `readings` router (or extend `months.ts`), mounted under `/api`:

- **`PATCH /api/readings/:id`** — body is any subset of:
  `{ cf?, color?, zone?, orient?, model?, plant? }`.
  - Validate per field (see §4). Reject the whole request 400 if any provided field is
    invalid; no partial writes.
  - When `color` changes, recompute `family = CFCore.normalizeColor(color).family || ''`
    and write it too.
  - Update only the provided columns (parameterized `UPDATE`). Return the updated row.
  - 404 if no row with that id.
- **`DELETE /api/readings/:id`** — delete one reading; decrement its file's `row_count`
  (single transaction). Return `{ ok, deleted, fileId }`. 404 if absent.

Constraints preserved: prepared statements only (no string-built SQL), backend binds
`127.0.0.1` only, no new outbound calls. `month_key` and `file_id` are **not** editable
(month is structural; moving rows between months/files is out of scope).

Client (`frontend/src/lib/api.ts`): add `updateReading(id, patch)` and
`deleteReading(id)` typed wrappers mirroring the existing `deleteFile` style.

## 2. Frontend — dedicated "Data" view

- **View switch:** a segmented `Dashboard | Data` control in `AppTopbar`. App holds
  `view: 'dashboard' | 'data'`. The topbar month selector applies to both views; the Data
  view shows the selected month's files + readings.
- **`components/data/DataView.tsx`** — orchestrates the view; receives `history`,
  `filters.monthKey`, and `reload()` from App.
- **`components/data/FilesPanel.tsx`** — shadcn Card + Table of the month's files
  (filename, plant, model, row count, imported date, Delete). Delete → confirm
  (AlertDialog) → `api.deleteFile` → `reload()` + toast.
- **`components/data/ReadingsGrid.tsx`** — shadcn Table, scrollable (max-height), of the
  month's readings: Color, Family (read-only), Checkzone, Position, Model, Plant, CF, and
  a delete-row action. A lightweight text filter (matches color/zone, client-side) to
  locate a row. Row count shown.

### Excel-style cell editing (`ReadingsGrid`)
- Click a cell → it becomes the right editor in place:
  - **Color** → shadcn Select of known colors (`CFCore.COLOR_FAMILY` keys + colors seen in
    history); on commit the Family cell updates from the server response.
  - **Position** → Select H / V. **Model** → Select DBL(Ranger) / Raptor. **Plant** →
    Select of `CFCore.PLANTS` (+ a "— none —" option).
  - **Checkzone** → text input. **CF** → number input.
- Commit on **Enter** or blur (`PATCH` with just that field); **Esc** cancels. While the
  request is in flight the cell is disabled; on success the row updates from the response
  and a toast confirms; on 400 the cell stays in edit and shows the error toast.
- Delete-row → trash icon → AlertDialog confirm → `api.deleteReading` → `reload()`.

New shadcn primitive: `alert-dialog` (for delete confirmations).

## 3. Data flow

App owns `history`, `months`, `filters`, `loadAll()`. It passes `history`,
`filters.monthKey`, and `reload = loadAll` into `DataView`. Every successful mutation
(file delete, reading edit, reading delete) calls `reload()`, refetching months/readings/
files so both the Data view and the Dashboard stay consistent. No optimistic local cache.

## 4. Validation (shared between client hint + backend enforcement)

| Field | Rule |
|-------|------|
| `cf` | finite number, `> 0` and `<= 200` |
| `color` | non-empty string (trimmed) |
| `zone` | non-empty string (trimmed) |
| `orient` | exactly `'H'` or `'V'` |
| `model` | `'Ranger'`, `'Raptor'`, or `null` |
| `plant` | one of `CFCore.PLANTS`, or `null` |

Backend is the source of truth (rejects 400 on any violation); the client mirrors the
rules to disable/flag bad input early.

## 5. Errors / edge cases

- Invalid edit → 400 + toast; cell stays in edit mode (no data lost).
- Deleting a file's last reading leaves an empty file (row_count 0); that file can then be
  removed in the Files panel.
- Empty month → "No readings for this month" empty state; Data view still lets you delete
  files.
- Concurrent edit conflicts are out of scope (single-user desktop app).

## 6. Testing

- **Backend:** during planning, check for an existing backend test harness. If present,
  add tests for PATCH (each field + family recompute + invalid → 400 + 404) and DELETE
  (row gone + row_count decremented). If absent, verify via a headless `curl` smoke
  against the packaged/dev backend: seed a row, PATCH it, GET to confirm; DELETE it,
  re-count. Document whichever was used.
- **Engines:** 15 CFLogic tests stay green (untouched).
- **Frontend:** `vite build` + `tsc --noEmit` clean; manual smoke (user): edit a CF and a
  color in the grid, confirm dashboard updates; delete a row; delete a file.

## 7. File structure

**New:** `backend/src/routes/readings.ts`; `frontend/src/components/data/{DataView,
FilesPanel,ReadingsGrid}.tsx`; `frontend/src/components/ui/alert-dialog.tsx` (generated).
**Modified:** `backend/src/server.ts` (mount router); `frontend/src/lib/api.ts` (two
wrappers); `frontend/src/App.tsx` (view state + render DataView); `AppTopbar.tsx` (view
switch).

## Risks

- **Color → family recompute:** must use the same `CFCore.normalizeColor` path as import,
  or edited rows group differently than imported ones. Mitigation: reuse the shared
  function server-side; cover with a backend test/smoke.
- **Grid performance:** a month can hold a few hundred rows; a plain scrollable table is
  fine at that scale (no virtualization needed — YAGNI).
- **Editable Select empty value:** Radix Select forbids empty-string item values; the
  Plant "none" option uses a sentinel mapped to `null` (same pattern as AppTopbar's file
  selector).
