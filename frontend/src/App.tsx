/* =========================================================================
 * App — top-level orchestration. Loads months/readings/standards from the
 * backend into a prototype-shaped `history` object so every CFLogic function
 * works unchanged, holds the filter state, and wires the import + standards
 * flows. Mirrors the prototype's renderAll() data flow over a SQLite backend.
 *
 * v2: chrome rebuilt on shadcn (AppShell + AppTopbar + AppSidebar). Content
 * cards are restyled in later tasks; legacy trend/checkzone cards are removed
 * in the cleanup task.
 * ========================================================================= */
import { useCallback, useEffect, useRef, useState } from 'react';
import { CFLogic } from './lib/shared';
import { api, type MonthRollup, type Standards, type ImportStaged } from './lib/api';
import { getVersion } from './lib/cf';
import { useFilters } from './hooks/useFilters';
import { computePreset, periodKeys, type History } from './lib/select';

import AppShell from './components/shell/AppShell';
import AppTopbar from './components/shell/AppTopbar';
import AppSidebar from './components/shell/AppSidebar';
import DropZone from './components/DropZone';
import AndonRibbon from './components/AndonRibbon';
import ProblemZones from './components/ProblemZones';
import ChartCards from './components/ChartCards';
import TrendCard from './components/TrendCard';
import DetailCard from './components/DetailCard';
import ImportReviewDialog from './components/ImportReviewDialog';
import StandardsDialog from './components/StandardsDialog';

function emptyHistory(): History {
  return { app: 'cf-wavescan-analyzer', schema: CFLogic.SCHEMA, savedAt: null, standards: CFLogic.defaultStandards(), months: {} };
}

export default function App() {
  const { filters, update, reset } = useFilters();
  const [history, setHistory] = useState<History>(emptyHistory);
  const [months, setMonths] = useState<MonthRollup[]>([]);
  const [version, setVersion] = useState('1.0.0');
  const [ready, setReady] = useState(false);

  const [pending, setPending] = useState<{ staged: ImportStaged; fileName: string } | null>(null);
  const [showStd, setShowStd] = useState(false);

  const [toast, setToast] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);
  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(''), 3200);
  }, []);

  const loadAll = useCallback(async (focusKey?: string) => {
    const [ms, std] = await Promise.all([api.months(), api.standards()]);
    const monthsObj: History['months'] = {};
    await Promise.all(
      ms.map(async (m) => {
        const [recs, files] = await Promise.all([api.readings(m.monthKey), api.files(m.monthKey)]);
        monthsObj[m.monthKey] = { label: m.label, files: files.map((f) => f.filename), records: recs };
      })
    );
    setMonths(ms);
    setHistory({ app: 'cf-wavescan-analyzer', schema: CFLogic.SCHEMA, savedAt: null, standards: std, months: monthsObj });
    setReady(true);
    return ms.map((m) => m.monthKey).sort();
  }, []);

  // Initial load.
  useEffect(() => {
    (async () => {
      try {
        setVersion(await getVersion());
        const keys = await loadAll();
        if (keys.length) update({ monthKey: keys[keys.length - 1] });
      } catch (e: any) {
        showToast('Could not reach the backend: ' + (e?.message || e));
        setReady(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasData = months.length > 0 && !!filters.monthKey;

  // Files for the app-bar month; disabled while a multi-month period is pooled.
  const pooled = periodKeys(history, filters).length > 1;
  const monthFiles = filters.monthKey && history.months[filters.monthKey] ? history.months[filters.monthKey].files : [];
  const fileSelLabel = pooled
    ? 'All files (period view)'
    : monthFiles.length > 1
    ? `All files (${monthFiles.length})`
    : 'All files';

  function onMonthChange(key: string) {
    // Recompute a relative period preset around the new anchor month.
    const relative = ['3', '6', 'ytd', 'all'].includes(filters.periodPreset);
    const next: any = { monthKey: key, fileSel: null, colorsSel: null };
    if (relative) next.periodSel = computePreset(history, { ...filters, monthKey: key }, filters.periodPreset);
    update(next);
  }

  async function onFile(file: File) {
    try {
      showToast('Parsing ' + file.name + '…');
      const staged = await api.upload(file);
      if (staged.rowCount === 0) {
        await api.discardImport(staged.id);
        showToast('No CF data recognised in ' + file.name + '.');
        return;
      }
      setPending({ staged, fileName: file.name });
    } catch (e: any) {
      showToast('Upload failed: ' + (e?.message || e));
    }
  }

  async function commitImport(body: { monthKey: string; model: string; plant: string | null }) {
    if (!pending) return;
    try {
      const res = await api.commitImport(pending.staged.id, body);
      setPending(null);
      await loadAll();
      update({ monthKey: res.monthKey, colorsSel: null });
      showToast(`${res.added} readings added to ${CFLogic.keyToLabel(res.monthKey)}.`);
    } catch (e: any) {
      showToast('Commit failed: ' + (e?.message || e));
    }
  }

  async function cancelImport() {
    if (pending) {
      try {
        await api.discardImport(pending.staged.id);
      } catch {
        /* ignore */
      }
    }
    setPending(null);
  }

  async function saveStandards(s: Standards) {
    try {
      await api.saveStandards(s);
      setHistory((h) => ({ ...h, standards: s }));
      setShowStd(false);
      showToast('Standards updated.');
    } catch (e: any) {
      showToast('Could not save standards: ' + (e?.message || e));
    }
  }

  // Colors present anywhere in history (for the standards per-color editor).
  const historyColors = Array.from(
    new Set(Object.values(history.months).flatMap((m) => m.records.map((r: any) => r.color)))
  );

  const topbar = (
    <AppTopbar
      months={months}
      monthKey={filters.monthKey}
      onMonthChange={onMonthChange}
      files={monthFiles}
      fileSel={filters.fileSel}
      onFileChange={(f) => update({ fileSel: f })}
      fileSelDisabled={pooled || monthFiles.length === 0}
      fileSelLabel={fileSelLabel}
      version={version}
      onImport={() => document.querySelector<HTMLInputElement>('.drop input[type=file]')?.click()}
      onStandards={() => setShowStd(true)}
      hasData={hasData}
    />
  );

  if (!ready) {
    return (
      <AppShell topbar={topbar} sidebar={<div />}>
        <div className="p-12 text-muted-foreground">Loading…</div>
      </AppShell>
    );
  }

  return (
    <>
      <AppShell
        topbar={topbar}
        sidebar={<AppSidebar history={history} filters={filters} update={update} onReset={reset} />}
      >
        <DropZone hasData={hasData} onFile={onFile} />
        {hasData && (
          <>
            <AndonRibbon history={history} filters={filters} />
            <ProblemZones history={history} filters={filters} onPickColor={(c) => update({ detailColor: c })} />
            <ChartCards history={history} filters={filters} />
            <TrendCard history={history} filters={filters} update={update} />
            <DetailCard history={history} filters={filters} update={update} />
          </>
        )}
      </AppShell>

      {pending && (
        <ImportReviewDialog
          staged={pending.staged}
          fileName={pending.fileName}
          onCommit={commitImport}
          onCancel={cancelImport}
        />
      )}
      {showStd && (
        <StandardsDialog
          standards={history.standards}
          historyColors={historyColors}
          onSave={saveStandards}
          onClose={() => setShowStd(false)}
        />
      )}

      <div id="toast" className={toast ? 'show' : ''} role="status" aria-live="polite">
        {toast}
      </div>
    </>
  );
}
