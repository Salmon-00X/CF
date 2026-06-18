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
      <SidebarTrigger className="-ml-1 text-primary-foreground hover:bg-white/10" />
      <Separator orientation="vertical" className="mr-1 h-6 bg-white/30" />

      <div className="flex rounded-md border border-white/25 bg-white/10 p-0.5">
        {(['dashboard', 'data'] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={p.view === v}
            onClick={() => p.onViewChange(v)}
            className={
              'rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors ' +
              (p.view === v
                ? 'bg-background text-foreground'
                : 'text-primary-foreground/80 hover:bg-white/10')
            }
          >
            {v}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="grid size-8 place-items-center rounded-md bg-white/15 text-xs font-bold text-primary-foreground">
          CF
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold">CF Wavescan Analyzer</div>
          <div className="text-[11px] text-primary-foreground/70">FTM · Paint Appearance</div>
        </div>
      </div>

      <div className="ml-2 flex items-center gap-2">
        <Select
          value={p.monthKey || undefined}
          disabled={!p.months.length}
          onValueChange={(v) => p.onMonthChange(v)}
        >
          <SelectTrigger className="h-9 w-[150px] border-white/25 bg-white/10 text-primary-foreground" aria-label="Select month">
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
          <SelectTrigger className="h-9 w-[170px] border-white/25 bg-white/10 text-primary-foreground" aria-label="Select uploaded file">
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
        <span className="hidden items-center gap-1.5 text-xs text-primary-foreground/80 sm:flex">
          <span
            className={
              'size-2 rounded-full ' + (p.hasData ? 'bg-emerald-500' : 'bg-muted-foreground/40')
            }
          />
          {p.hasData ? 'Saved locally' : 'No data yet'}
        </span>
        <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={p.onImport}>
          Import data…
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="border-white/30 bg-transparent text-primary-foreground hover:bg-white/10 hover:text-primary-foreground"
          onClick={p.onStandards}
        >
          Standards
        </Button>
        <span className="text-xs text-primary-foreground/70">v{p.version}</span>
      </div>
    </>
  );
}
