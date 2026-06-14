/* =========================================================================
 * AppBar — Ford gradient header (.appbar). Month + File selectors, version,
 * Import / Standards buttons, history dot, sidebar toggle.
 *
 * In this backend-backed build, imports commit straight to SQLite, so the
 * "history" dot simply reflects whether data is loaded (green) vs empty (grey)
 * — the prototype's connect/save/export-to-file flow is replaced by the DB.
 * ========================================================================= */
import type { MonthRollup } from '../lib/api';

interface Props {
  months: MonthRollup[];
  monthKey: string | null;
  onMonthChange: (key: string) => void;
  files: string[];
  fileSel: string | null;
  onFileChange: (file: string | null) => void;
  fileSelDisabled: boolean;
  fileSelLabel: string;
  version: string;
  onImport: () => void;
  onStandards: () => void;
  onToggleSidebar: () => void;
  hasData: boolean;
}

export default function AppBar(p: Props) {
  return (
    <header className="appbar">
      <button
        className="nav-toggle"
        type="button"
        title="Show / hide filters"
        aria-label="Toggle filters panel"
        onClick={p.onToggleSidebar}
      >
        ☰
      </button>
      <div className="brand">
        <div className="mark" aria-hidden="true">
          CF
        </div>
        <div>
          <h1>CF Wavescan Analyzer</h1>
          <div className="sub">FTM · Paint Appearance</div>
        </div>
      </div>

      <span className="bar-field">
        <label className="eyebrow" htmlFor="monthSel" style={{ color: '#b9c9ef' }}>
          Month
        </label>
        <select
          id="monthSel"
          aria-label="Select month"
          value={p.monthKey || ''}
          disabled={!p.months.length}
          onChange={(e) => p.onMonthChange(e.target.value)}
        >
          {p.months.length ? (
            // newest first
            p.months
              .slice()
              .reverse()
              .map((m) => (
                <option key={m.monthKey} value={m.monthKey}>
                  {m.label}
                </option>
              ))
          ) : (
            <option value="">No data yet</option>
          )}
        </select>
      </span>

      <span className="bar-field">
        <label className="eyebrow" htmlFor="fileSel" style={{ color: '#b9c9ef' }}>
          File
        </label>
        <select
          id="fileSel"
          aria-label="Select uploaded file"
          title="Switch between previously uploaded files"
          value={p.fileSel || ''}
          disabled={p.fileSelDisabled}
          onChange={(e) => p.onFileChange(e.target.value || null)}
        >
          <option value="">{p.fileSelLabel}</option>
          {p.files.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </span>

      <span className="spacer" />

      <div className="histstate" title="Local database status">
        <span className={'dot' + (p.hasData ? ' ok' : '')} />
        <span>{p.hasData ? 'Saved locally' : 'No data yet'}</span>
      </div>
      <button className="btn primary" type="button" onClick={p.onImport}>
        Import data…
      </button>
      <button className="btn ghost" type="button" onClick={p.onStandards}>
        Standards
      </button>
      <span className="histstate" style={{ marginLeft: 4 }} title="App version">
        v{p.version}
      </span>
    </header>
  );
}
