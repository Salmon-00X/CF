/* =========================================================================
 * DataView — file management + spreadsheet-style reading editing for the
 * selected month. Orchestrates FilesPanel + ReadingsGrid; every mutation
 * inside them calls reload() (App.loadAll) so the dashboard stays in sync.
 * ========================================================================= */
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
