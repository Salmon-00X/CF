# CF Wavescan Analyzer

[![CI](https://github.com/Salmon-00X/CF/actions/workflows/ci.yml/badge.svg)](https://github.com/Salmon-00X/CF/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/Salmon-00X/CF?sort=semver)](https://github.com/Salmon-00X/CF/releases/latest)

A Ford paint-appearance (CF / Wavescan) analysis dashboard — a Windows desktop app that
imports the monthly CF Excel reports, scores each color/checkzone against the Wavescan
standards, and surfaces what to fix first. Runs fully offline: an Electron shell over a local
Express + SQLite backend bound to `127.0.0.1` only.

## Features

- **Excel import** — drop the monthly CF workbook; per-color sheets, June-format, or the flat
  export are parsed and committed to a local SQLite database.
- **Status dashboard** — PASS / WARNING / FAIL KPI cards, boxplot / Pareto / ranking charts,
  and a "problem checkzones" table sorted worst-first.
- **In-app data editing** — a dedicated Data view to delete imported files and fix readings
  spreadsheet-style (CF value, color, checkzone, position, model, plant) without re-uploading.
- **Configurable standards** — per-family and per-color Ford / minimum targets.
- **Data-dense UI** — shadcn/ui, Ford-navy + amber theme, self-hosted Fira typography.

## Tech stack

npm-workspaces monorepo: `shared` (parser + analysis engines), `backend` (Express + SQLite),
`frontend` (React + Vite + Tailwind/shadcn + Plotly), `desktop` (Electron + electron-builder).

## Development

```bash
npm install
npm run dev:backend     # Express on 127.0.0.1:4000
npm run dev:frontend    # Vite dev server (proxies /api)
```

## Tests

```bash
npm test --workspace @cf-wavescan/shared     # engine unit tests
npm test --workspace @cf-wavescan/backend    # /api endpoint tests
npm test --workspace @cf-wavescan/frontend   # component/interaction tests (Vitest)
```

All three suites run in CI on every push and pull request.

## Build the installer

```bash
npm run build:win       # -> desktop/release/CF Wavescan Analyzer Setup <version>.exe
```

## Download

Prebuilt Windows installers are on the [Releases](https://github.com/Salmon-00X/CF/releases/latest) page.
