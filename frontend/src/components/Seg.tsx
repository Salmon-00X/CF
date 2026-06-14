/* Segmented control (.seg) — used for Model, Position, Chart type, Trend. */
interface Opt {
  v: string;
  label: string;
  title?: string;
}

interface Props {
  options: Opt[];
  value: string;
  onChange: (v: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
  dark?: boolean;
  style?: React.CSSProperties;
}

export default function Seg({ options, value, onChange, ariaLabel, disabled, dark, style }: Props) {
  return (
    <div className={'seg' + (dark ? ' seg-on-dark' : '')} role="group" aria-label={ariaLabel} style={style}>
      {options.map((o) => (
        <button
          key={o.v}
          type="button"
          title={o.title}
          className={o.v === value ? 'on' : ''}
          aria-pressed={o.v === value}
          disabled={disabled}
          onClick={() => onChange(o.v)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
