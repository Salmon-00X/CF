/* =========================================================================
 * DropZone — drag/browse upload (.xlsx/.xlsm/.xls). After the first import it
 * shows the compact "Add a month" row. Selecting a file calls onFile (App
 * uploads and opens the review dialog).
 *
 * NOTE: the root keeps the `drop` class and the hidden file <input> so the
 * topbar "Import data…" button can trigger it via
 * `document.querySelector('.drop input[type=file]')` (see App.tsx). Do not
 * remove that hook.
 * ========================================================================= */
import { useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Upload } from 'lucide-react';

interface Props {
  hasData: boolean;
  onFile: (file: File) => void;
}

const ACCEPT = /\.(xlsx|xlsm|xls)$/i;

export default function DropZone({ hasData, onFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);

  function pick(files: FileList | null) {
    const f = files && files[0];
    if (!f) return;
    if (!ACCEPT.test(f.name)) return; // backend also rejects (415)
    onFile(f);
  }

  return (
    <Card
      className={cn(
        'drop border-2 border-dashed transition-colors',
        over ? 'border-primary bg-primary/5' : 'border-border',
        hasData ? 'p-3' : 'p-8'
      )}
      aria-label="Upload CF data"
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        pick(e.dataTransfer.files);
      }}
    >
      {!hasData ? (
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="grid size-12 place-items-center rounded-full bg-primary/10 text-primary">
            <Upload className="size-6" />
          </div>
          <div className="text-base font-semibold">Drop the monthly CF Excel file here</div>
          <p className="max-w-prose text-sm text-muted-foreground">
            June-format report, per-color sheets, or the flat export — the file name carries the
            month (e.g.{' '}
            <span className="font-mono text-foreground">04__June26_CF_data.xlsx</span>).
          </p>
          <Button type="button" onClick={() => inputRef.current?.click()}>
            Choose file…
          </Button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
            <Upload className="size-4" />
          </div>
          <span className="text-sm font-semibold">Add a month</span>
          <p className="text-sm text-muted-foreground">
            Drop the next CF Excel file anywhere in this box, or
          </p>
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
            Choose file…
          </Button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xlsm,.xls"
        hidden
        onChange={(e) => {
          pick(e.target.files);
          e.target.value = '';
        }}
      />
    </Card>
  );
}
