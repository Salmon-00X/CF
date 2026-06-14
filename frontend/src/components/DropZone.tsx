/* =========================================================================
 * DropZone (.drop) — drag/browse upload. Port of the .drop section +
 * handleFiles(). Accepts .xlsx/.xlsm/.xls. After the first import it shows the
 * compact "Add a month" form. Selecting a file calls onFile (App uploads and
 * opens the review dialog).
 * ========================================================================= */
import { useRef, useState } from 'react';

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
    <section
      className={'drop' + (hasData ? ' compact' : '') + (over ? ' over' : '')}
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
        <div>
          <div className="drop-ico" aria-hidden="true">
            ⇪
          </div>
          <div className="big">Drop the monthly CF Excel file here</div>
          <p>
            June-format report, per-color sheets, or the flat export — the file name carries the month (e.g.{' '}
            <span className="num">04__June26_CF_data.xlsx</span>).
          </p>
          <button className="btn primary" type="button" onClick={() => inputRef.current?.click()}>
            Choose file…
          </button>
        </div>
      ) : (
        <div id="dropSlim" style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <div className="drop-ico" aria-hidden="true">
            ⇪
          </div>
          <span className="big">Add a month</span>
          <p>Drop the next CF Excel file anywhere in this box, or</p>
          <button className="btn" type="button" onClick={() => inputRef.current?.click()}>
            Choose file…
          </button>
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
    </section>
  );
}
