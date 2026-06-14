/* =========================================================================
 * StandardsDialog (<dialog id="dlgStd">) — two tabs: Color Families (editable
 * table) and Per-Color Overrides. Port of openStandards()/saveStandards()/
 * resetStandards()/applyColorOverride()/clearColorOverride(). FTM badge marks
 * IMG-reference FTM colors. Save → PUT /api/standards.
 * ========================================================================= */
import { useEffect, useMemo, useRef, useState } from 'react';
import { CFCore, CFLogic } from '../lib/shared';
import type { Standards, StandardRow } from '../lib/api';
import Seg from './Seg';

interface Props {
  standards: Standards;
  historyColors: string[];
  onSave: (s: Standards) => void;
  onClose: () => void;
}

const KEYS: Array<keyof StandardRow> = ['fordH', 'fordV', 'minH', 'minV'];

function titleCaseColor(s: string) {
  return s.replace(/\b[a-z]/g, (c) => c.toUpperCase()).replace(/\bIi\b/g, 'II');
}

export default function StandardsDialog({ standards, historyColors, onSave, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [tab, setTab] = useState<'family' | 'color'>('family');
  const [families, setFamilies] = useState<Record<string, StandardRow>>(() =>
    JSON.parse(JSON.stringify(standards.families))
  );
  const [colors, setColors] = useState<Record<string, StandardRow>>(() =>
    JSON.parse(JSON.stringify(standards.colors || {}))
  );

  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);

  // Known colors: the PDF reference list + anything seen in history.
  const known = useMemo(() => {
    const seen: Record<string, { name: string; family: string; ftm: boolean }> = {};
    Object.keys(CFCore.COLOR_FAMILY).forEach((k) => {
      seen[k] = { name: titleCaseColor(k), family: CFCore.COLOR_FAMILY[k], ftm: !!CFCore.FTM_COLORS[k] };
    });
    historyColors.forEach((name) => {
      const lk = name.toLowerCase();
      if (!seen[lk]) {
        const fam = (CFCore.normalizeColor(name) || {}).family || CFCore.COLOR_FAMILY[lk] || '';
        seen[lk] = { name, family: fam, ftm: !!CFCore.FTM_COLORS[lk] };
      }
    });
    return Object.values(seen).sort((a, b) => a.family.localeCompare(b.family) || a.name.localeCompare(b.name));
  }, [historyColors]);

  const [selColor, setSelColor] = useState<string>(() => (known[0] ? known[0].name : ''));

  const selFamily =
    (CFCore.normalizeColor(selColor) || {}).family || CFCore.COLOR_FAMILY[selColor.toLowerCase()] || '';
  const selIsFtm = !!CFCore.FTM_COLORS[selColor.toLowerCase()];
  const famDefault: StandardRow =
    families[selFamily] || CFCore.DEFAULT_STANDARDS[selFamily] || { fordH: 0, fordV: 0, minH: 0, minV: 0 };
  const [editor, setEditor] = useState<StandardRow>(famDefault);

  // Reload the per-color editor when the selected color changes.
  useEffect(() => {
    setEditor(colors[selColor] || famDefault);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selColor]);

  function setFamCell(fam: string, k: keyof StandardRow, v: number) {
    setFamilies((prev) => ({ ...prev, [fam]: { ...prev[fam], [k]: v } }));
  }

  function valid(row: StandardRow) {
    return KEYS.every((k) => isFinite(row[k]) && row[k] > 0 && row[k] <= 200);
  }

  function applyOverride() {
    if (!selColor) return;
    if (!valid(editor)) {
      alert('Targets must be numbers between 0 and 200.');
      return;
    }
    if (editor.fordH <= editor.minH || editor.fordV <= editor.minV) {
      if (!window.confirm('Ford target is not above the Minimum for ' + selColor + '. Save anyway?')) return;
    }
    setColors((prev) => ({ ...prev, [selColor]: { ...editor } }));
  }

  function removeOverride(name: string) {
    setColors((prev) => {
      const next = { ...prev };
      delete next[name];
      return next;
    });
  }

  function save() {
    for (const fam of Object.keys(families)) {
      if (!valid(families[fam])) {
        alert('Check the value for ' + fam + ' — each must be a number between 0 and 200.');
        setTab('family');
        return;
      }
    }
    const bad = Object.keys(families).filter(
      (f) => families[f].fordH <= families[f].minH || families[f].fordV <= families[f].minV
    );
    if (bad.length && !window.confirm('For ' + bad.join(', ') + ' the Ford target is not above the Minimum. Save anyway?'))
      return;
    onSave({ families, colors });
  }

  function reset() {
    const d = CFLogic.defaultStandards();
    setFamilies(JSON.parse(JSON.stringify(d.families)));
    setColors({});
  }

  const overrideNames = Object.keys(colors).sort();

  return (
    <dialog ref={ref} className="dlg-wide" aria-labelledby="stdTitle" onCancel={(e) => { e.preventDefault(); onClose(); }}>
      <div className="dlg-head">
        <h2 id="stdTitle">Wavescan standards</h2>
        <span className="spacer" style={{ flex: 1 }} />
        <Seg
          dark
          ariaLabel="Standards tab"
          value={tab}
          onChange={(v) => setTab(v as 'family' | 'color')}
          options={[
            { v: 'family', label: 'Families' },
            { v: 'color', label: 'Per-color overrides' },
          ]}
        />
      </div>
      <div className="dlg-body">
        {tab === 'family' ? (
          <div>
            <table className="mini">
              <thead>
                <tr>
                  <th>Color family</th>
                  <th className="r">Ford H</th>
                  <th className="r">Ford V</th>
                  <th className="r">Min H</th>
                  <th className="r">Min V</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(families).map((fam) => (
                  <tr key={fam}>
                    <td>{fam}</td>
                    {KEYS.map((k) => (
                      <td className="r" key={k}>
                        <input
                          type="number"
                          step="0.1"
                          value={families[fam][k]}
                          aria-label={fam + ' ' + k}
                          onChange={(e) => setFamCell(fam, k, Number(e.target.value))}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="note">
              Pass when <b>avg ≥ Min + 2</b>. Warning when avg is in <b>[Min, Min + 2)</b> — getting close to the floor.
              Fail when avg is below Min. The Ford target stays as the dashed reference line on charts but no longer
              changes the status. Ranger (shown as <b>DBL</b>) and Raptor share these.
            </p>
          </div>
        ) : (
          <div>
            <div className="frow" style={{ marginBottom: 10 }}>
              <label style={{ flex: 1 }}>
                Color
                <select value={selColor} onChange={(e) => setSelColor(e.target.value)}>
                  {known.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name + (c.ftm ? '  ✓ FTM' : '')}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Family
                <input type="text" readOnly value={selFamily || '—'} style={{ background: '#f7faff' }} />
              </label>
            </div>
            <table className="mini">
              <thead>
                <tr>
                  <th>Targets for this color only</th>
                  <th className="r">Ford H</th>
                  <th className="r">Ford V</th>
                  <th className="r">Min H</th>
                  <th className="r">Min V</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>
                    <b>{selColor || '—'}</b>
                    {selIsFtm && <span className="badge-ftm">FTM</span>}
                  </td>
                  {KEYS.map((k) => (
                    <td className="r" key={k}>
                      <input
                        type="number"
                        step="0.1"
                        value={editor[k]}
                        onChange={(e) => setEditor((prev) => ({ ...prev, [k]: Number(e.target.value) }))}
                      />
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button className="btn primary" type="button" onClick={applyOverride}>
                Apply override
              </button>
              <button className="btn" type="button" onClick={() => removeOverride(selColor)}>
                Remove override
              </button>
            </div>
            <p className="note">
              A per-color override is used in place of the family default for every reading of this color — useful for
              variant chemistries. The badge marks colors actively run at FTM per the IMG reference.
            </p>
            <h3 style={{ margin: '18px 0 6px', fontSize: 11, letterSpacing: '.1em', color: 'var(--muted)', textTransform: 'uppercase' }}>
              Current overrides
            </h3>
            {overrideNames.length ? (
              <table className="mini">
                <thead>
                  <tr>
                    <th>Color</th>
                    <th className="r">Ford H</th>
                    <th className="r">Ford V</th>
                    <th className="r">Min H</th>
                    <th className="r">Min V</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {overrideNames.map((n) => (
                    <tr key={n}>
                      <td>{n}</td>
                      <td className="r">{colors[n].fordH}</td>
                      <td className="r">{colors[n].fordV}</td>
                      <td className="r">{colors[n].minH}</td>
                      <td className="r">{colors[n].minV}</td>
                      <td className="r">
                        <button className="remove-x" type="button" title="Remove" onClick={() => removeOverride(n)}>
                          ✕
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="note">No overrides yet — every color uses its family default.</p>
            )}
          </div>
        )}
      </div>
      <div className="dlg-foot">
        <button className="btn" type="button" onClick={reset}>
          Reset to defaults
        </button>
        <span className="spacer" style={{ flex: 1 }} />
        <button className="btn" type="button" onClick={onClose}>
          Close
        </button>
        <button className="btn primary" type="button" onClick={save}>
          Save standards
        </button>
      </div>
    </dialog>
  );
}
