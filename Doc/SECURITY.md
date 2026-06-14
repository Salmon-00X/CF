# Security review checklist

Use this when answering corporate IT's "is this safe to install?"
questionnaire and when reviewing any PR that touches network, file I/O,
or the Electron main process.

## What the app is, in one sentence

A signed Windows desktop installer that, at runtime, parses Excel files
the user drops into the window, stores results in a local SQLite file
under their own user profile, and renders charts using a bundled
JavaScript library. **No outbound network calls. No listening port
reachable from the network.**

## Threat model (what we defend against, what we do not)

| Threat | Defence |
|---|---|
| Tampered binary | Code-signed with corporate cert; `asar: true` packs the app so a casual file-swap is visible. |
| Malicious Excel triggering parser exploit | The parser is `xlsx@0.18.5` (auditable, well-known). Files capped at 25 MB by multer. No formula execution; we read raw cell values via `sheet_to_json`. |
| Cross-site scripting in the renderer | Strict CSP in `frontend/index.html`: `script-src 'self'; object-src 'none'; frame-ancestors 'none'`. `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true` in the BrowserWindow. |
| Remote attacker reaching the backend | The Express server binds **`127.0.0.1`** only. It is not reachable from another machine on the LAN. Verify with `netstat -an | findstr 4000`. |
| Local privilege escalation via electron preload | The preload exposes a single object `window.cf` with the apiBase getter only. Nothing that takes user-controlled input is passed through. |
| Supply-chain compromise | Lockfile-pinned (`package-lock.json`). Only one network egress in CI (`npm install`). Generate an SBOM (`npm sbom`) per release and store in the IT repo. |
| Data exfiltration | No outbound HTTP, no fetch to anything other than `127.0.0.1`. The strict CSP `connect-src 'self'` blocks any inadvertent regression. |
| Auto-update channel exploited | Auto-update is **disabled** unless IT sanctions a corporate update server. Ship version bumps as fresh signed installers. |
| Tampered SQLite database | The DB lives in the user's own profile; we don't claim to protect against the user editing their own data. If integrity becomes a real requirement, sign each export. |
| Logged secrets / cert leakage | The build never logs the cert password (use env vars + electron-builder's `CSC_KEY_PASSWORD`). Don't commit anything from `desktop/build-resources/secrets/`. |

## Electron security checklist (per the official guide)

Confirmed in `desktop/electron/main.ts`:

- [x] `contextIsolation: true`
- [x] `nodeIntegration: false`
- [x] `sandbox: true`
- [x] `webSecurity: true`
- [x] `enableRemoteModule` not set (default `false` in current Electron)
- [x] CSP set HTML-side
- [x] `will-navigate` handler blocks navigation off `127.0.0.1` / `file://`
- [x] `setWindowOpenHandler` denies new windows; OS browser handles real links
- [x] No `<webview>` tag usage
- [x] Versions pinned; planned monthly bump for Electron security patches
- [x] `asar: true` in electron-builder

## Network surface

| Surface | Bound to | Reachable from | Notes |
|---|---|---|---|
| Express backend | `127.0.0.1:<random>` (production), `127.0.0.1:4000` (dev) | only the Electron renderer on the same host | port chosen at boot to avoid collisions |
| Renderer fetches | `127.0.0.1:<port>` only (CSP `connect-src 'self'` after Electron rewrites) | n/a | no third-party origins |
| OS browser hop | OS-default browser via `shell.openExternal` | only if user clicks an explicit link (currently none) | |

## Data at rest

- Location: `%APPDATA%\CFWavescan\cf-data\cf.sqlite` (Windows) / `~/Library/Application Support/CFWavescan/cf-data/` (macOS).
- Backed up to SharePoint manually by the user via the **Export** button (writes a JSON file the user chooses); we don't write to SharePoint directly.
- No encryption at rest by default. The DB file inherits NTFS permissions (only the logged-in user can read it). If FDE / BitLocker is mandated, that handles it at the OS level. SQLite can be swapped to SQLCipher in `db.ts` if column-level encryption is required later.

## Things IT should verify on the packaged binary

```powershell
# 1. Signature is valid and matches Ford Motor Company
Get-AuthenticodeSignature "CF Wavescan Analyzer Setup 0.2.0.exe"

# 2. Outbound connections at runtime — run while using the app
netstat -bo | findstr CFWavescan          # only entries should be 127.0.0.1

# 3. Files written are in the user profile only
Procmon : filter Process Name = "CF Wavescan Analyzer.exe", show Path
```

## What we don't do

- We do not collect telemetry. No analytics SDK. No crash reporter.
- We do not phone home for updates. Distribute new versions via the IT
  software catalog or SharePoint.
- We do not ask for elevated privileges. The NSIS installer is configured
  `perMachine: false` — installs into the user's AppData without UAC.

## Reporting issues

If a security issue is found, file an internal ticket and tag the
maintainer; do not disclose publicly until a fix is shipped.
