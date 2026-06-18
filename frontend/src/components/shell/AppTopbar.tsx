/* =========================================================================
 * AppTopbar — month + file selectors, Import / Standards actions, DB status,
 * version. Replaces the legacy AppBar. The sidebar toggle is the shadcn
 * SidebarTrigger (rail collapse), so no onToggleSidebar prop here.
 *
 * Note: Radix Select forbids an empty-string item value, so the "All files"
 * option uses the ALL sentinel and maps back to null at the boundary.
 * ========================================================================= */
import type { MonthRollup } from '../../lib/api';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const ALL = '__all__';

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
  hasData: boolean;
  view: 'dashboard' | 'data';
  onViewChange: (v: 'dashboard' | 'data') => void;
}

export default function AppTopbar(p: Props) {
  const monthsNewestFirst = p.months.slice().reverse();
  return (
    <>
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-6" />

      <div className="flex rounded-md border bg-background p-0.5">
        {(['dashboard', 'data'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={p.view === v}
            onClick={() => p.onViewChange(v)}
            className={
              'rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ' +
              (p.view === v
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted')
            }
          >
            {v}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-md bg-primary text-xs font-bold text-primary-foreground">
          CF
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">CF Wavescan Analyzer</div>
          <div className="text-[11px] text-muted-foreground">FTM · Paint Appearance</div>
        </div>
      </div>

      <div className="ml-2 flex items-center gap-2">
        <Select
          value={p.monthKey || undefined}
          disabled={!p.months.length}
          onValueChange={(v) => p.onMonthChange(v)}
        >
          <SelectTrigger className="h-9 w-[150px]" aria-label="Select month">
            <SelectValue placeholder="No data yet" />
          </SelectTrigger>
          <SelectContent>
            {monthsNewestFirst.map((m) => (
              <SelectItem key={m.monthKey} value={m.monthKey}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={p.fileSel ?? ALL}
          disabled={p.fileSelDisabled}
          onValueChange={(v) => p.onFileChange(v === ALL ? null : v)}
        >
          <SelectTrigger className="h-9 w-[170px]" aria-label="Select uploaded file">
            <SelectValue placeholder={p.fileSelLabel} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{p.fileSelLabel}</SelectItem>
            {p.files.map((f) => (
              <SelectItem key={f} value={f}>
                {f}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <span className="hidden items-center gap-1.5 text-xs text-muted-foreground sm:flex">
          <span
            className={
              'size-2 rounded-full ' + (p.hasData ? 'bg-emerald-500' : 'bg-muted-foreground/40')
            }
          />
          {p.hasData ? 'Saved locally' : 'No data yet'}
        </span>
        <Button size="sm" onClick={p.onImport}>
          Import data…
        </Button>
        <Button size="sm" variant="outline" onClick={p.onStandards}>
          Standards
        </Button>
        <span className="text-xs text-muted-foreground">v{p.version}</span>
      </div>
    </>
  );
}
