# Architecture

## High-level

```
┌───────────────────────────────────────────────────────────┐
│  CF Wavescan Analyzer Setup.exe   (NSIS installer)        │
│  ┌─────────────────────────────────────────────────────┐  │
│  │ Electron 33  (main process — Node 20)               │  │
│  │  ├─ spawns embedded backend (Express + better-sqlite3)│ │
│  │  │     127.0.0.1:<random>                            │ │
│  │  └─ opens BrowserWindow                              │ │
│  │       ├─ preload.cjs   ── window.cf                  │ │
│  │       └─ renderer:  React + Vite build               │ │
│  │            └─ fetch  ─────►  127.0.0.1:<port>/api   │ │
│  └─────────────────────────────────────────────────────┘  │
│                                                            │
│  Data:   %APPDATA%\CFWavescan\cf-data\cf.sqlite           │
└───────────────────────────────────────────────────────────┘
                       ▲
                       │ user drops an .xlsx
                       │
                       └──── one Excel file at a time
                             from Outlook / SharePoint
```

## Modules

### `shared/` — `@cf-wavescan/shared`

Pure functions, no I/O. Used by both backend and frontend so the parser
and analytics never drift between them. Two layers:

- **types.ts** — TS interfaces (`Reading`, `History`, `Standards`, …).
- **core.cjs / logic.cjs** — implementations (lifted unchanged from
  prototype). To be migrated to native TS — see HANDOFF §6.A.

### `backend/` — `@cf-wavescan/backend`

Express on Node. Routes are thin: validate input with Zod, call into
`shared/`, persist via `db.ts`. No business logic lives here that
isn't already in `shared/`.

```
POST /api/imports                upload .xlsx, parse, stage
POST /api/imports/:id/commit     persist to SQLite
DELETE /api/imports/:id          discard a staged import
GET  /api/months                 month rollup
GET  /api/months/:key/readings   raw rows
GET  /api/months/:key/files      file list
DELETE /api/files/:id            drop a file's rows
GET  /api/history                full history (used to seed renderer)
GET  /api/standards              read standards
PUT  /api/standards              write standards
GET  /api/analysis/summary?period=2026-05,2026-06&plant=FTM,AAT
GET  /api/analysis/mom?month=2026-05
```

### `frontend/` — `@cf-wavescan/frontend`

React + Vite + TypeScript. Renders the same dashboard layout as the
prototype (app bar / sidebar / drop zone / ribbon / problem zones /
chart cards / detail card). Plotly is imported from
`plotly.js-dist-min`; charts are wrapped in a `<PlotlyChart>` hook
that calls `Plotly.react` on prop changes.

### `desktop/` — `@cf-wavescan/desktop`

Electron 33. The main process boots the embedded backend on a free
`127.0.0.1` port, polls `/api/health` until it's ready, then opens a
single BrowserWindow that loads the Vite-built renderer. On quit,
sends SIGTERM to the backend child process.

## Data flow

```
USER drops .xlsx
   │
   ▼
DropZone.tsx ── POST /api/imports ──► imports.ts
                                        │ Core.parseSheets()  (shared)
                                        │ stage in PENDING + tmp file
                                        ▼
                                      { id, parsed, monthHint }
   ◄──────────────────────────────────────
   │
   ▼
ImportReviewDialog (TODO) ── POST /api/imports/:id/commit ──► imports.ts
                                                                │ DB:  INSERT into files + readings
                                                                ▼
                                                              { ok: true, monthKey, added }
   │
   ▼
state setReload → MonthsList re-fetches → Sidebar Period dropdown gains the new month
```

## Status logic (v2)

```
                                Min     Min+2 (=Min+WARNING_BAND)    Ford
                                 │       │                            │
   FAIL                         WARNING  │           PASS             │     (still PASS — Ford is reference only)
   ──────────────────────────────│──────►│────────────────────────────│─────────────►
                                 ▲       ▲                            ▲
                              avg < Min  ▲                            ▲
                                         avg in [Min, Min+2)          ▲
                                                          avg ≥ Min+2 ▲
```

This rule lives in `shared/src/core.cjs:statusOf()`. `WARNING_BAND`
is exported so a future plant-tunable setting is one line away.

## Standards schema (v2)

```ts
interface Standards {
  families: Record<Family, StandardRow>;
  colors:   Record<string, StandardRow>;   // optional per-color override
}
```

`targetsFor(family, standards, colorName)` returns the per-color row
when present, otherwise the family row. v1 history files (flat shape)
are migrated forward in `loadHistory()`.

## Performance budget

- Parser: 5–20k rows per `.xlsx`, runs in <300 ms in dev.
- SQLite: a single month typically holds 200–1000 readings. Indexes
  cover `(month_key, color, plant)`; no current need for partitioning.
- Renderer: Plotly charts render <100ms for ≤1000 points. Use
  `Plotly.react` with the signature-purge trick from the prototype.

## Future expansion knobs

| When you need… | Touch |
|---|---|
| Multi-user / hosted | `backend/src/db.ts` → swap SQLite for Postgres; remove the Electron wrapper; deploy backend behind a reverse proxy. |
| Auth | Add an `auth/` middleware layer in `backend/` and `<AuthProvider>` in `frontend/`. |
| Realtime collab | Add a WebSocket on the backend; rendering store on the frontend. |
| Better data ingestion (Power Automate, etc.) | Add a `POST /api/imports/from-url` route that fetches an Excel from SharePoint with a service account. |
