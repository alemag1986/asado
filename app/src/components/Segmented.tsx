import './Segmented.css';

interface Option<T extends string> {
  value: T;
  label: string;
}

interface Props<T extends string> {
  options: Option<T>[];
  value: T;
  onChange: (value: T) => void;
  label: string;
}

export function Segmented<T extends string>({ options, value, onChange, label }: Props<T>) {
  return (
    <fieldset class="seg" role="radiogroup" aria-label={label}>
      <legend class="mono-sm">{label}</legend>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          class={`seg__opt${opt.value === value ? ' seg__opt--on' : ''}`}
          onClick={() => onChange(opt.value)}
        >
          <span class="seg__label">{opt.label}</span>
        </button>
      ))}
    </fieldset>
  );
}