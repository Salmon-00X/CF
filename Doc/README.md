# CF Wavescan Analyzer

Desktop dashboard for tracking **CF (Clarity / Fullness)** Wavescan
paint-appearance data across Ford assembly plants (FTM / AAT / FVL /
SAP). Drop the monthly Excel export, get an instant pass/warning/fail
breakdown, ranked problem-checkzone digest, and Minitab-style charts —
without opening Minitab or PowerPoint.

> **For developers:** start with [`docs/HANDOFF.md`](docs/HANDOFF.md).
> Everything you need to continue the work is there.
>
> **For end users:** download `CF Wavescan Analyzer Setup.exe` from the
> IT software catalog, double-click, follow the installer. No Node, no
> command line, no IT ticket.

## What's where

```
prototype/   the original single-HTML analyzer (frozen reference, 75 tests)
shared/      @cf-wavescan/shared — parser + analytics, reusable
backend/     @cf-wavescan/backend — Express + SQLite API (localhost only)
frontend/    @cf-wavescan/frontend — React + Vite + TypeScript UI
desktop/     @cf-wavescan/desktop — Electron wrapper → signed .exe
docs/        PROJECT.md, ARCHITECTURE.md, SECURITY.md, HANDOFF.md
```

## Quick start (developer)

```bash
npm install                      # installs all four workspaces
npm -w shared run test           # 68 tests should pass

# in two terminals:
npm -w backend run dev           # API on http://127.0.0.1:4000
npm -w frontend run dev          # UI on http://localhost:5173

# build the Windows installer:
npm -w desktop run dist:win      # → desktop/release/*.exe
```

## Status

| Pillar | State |
|---|---|
| Parser + analytics (`shared/`) | **ported** from prototype, 68 tests passing, migration to native TS pending |
| Backend (`backend/`) | **skeleton** — all routes mounted, SQLite working, hardening + tests pending |
| Frontend (`frontend/`) | **skeleton** — drop zone + months list working, full UI port pending |
| Desktop (`desktop/`) | **skeleton** — main + preload wired with security defaults, `electron-builder` config in place, code-signing cert pending |
| Tests | shared: ✅ · backend: ⏳ · frontend: ⏳ · e2e: ⏳ |

See [`docs/HANDOFF.md`](docs/HANDOFF.md) §6 for the ordered TODO list.

## Security

Built to pass corporate IT review. Highlights:

- Single signed `.exe`, no installer download-at-runtime
- Backend binds **`127.0.0.1`** only — not reachable from the network
- Electron renderer locked down (`contextIsolation`, `sandbox`, strict CSP)
- All data stays local (`%APPDATA%\CFWavescan\cf-data\`)
- No telemetry, no auto-update phone-home, no third-party CDNs
- See [`docs/SECURITY.md`](docs/SECURITY.md) for the full checklist

## License

Internal Ford use only. Do not redistribute.
