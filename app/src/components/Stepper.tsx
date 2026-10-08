import './Stepper.css';

interface Props {
  value: number;
  onChange: (value: number) => void;
  label: string;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
}

export function Stepper({
  value,
  onChange,
  label,
  unit,
  min = 0,
  max = 999,
  step = 1,
}: Props) {
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  return (
    <div class="stepper">
      <span class="stepper__label mono-sm">{label}</span>
      <div class="stepper__controls">
        <button
          type="button"
          class="stepper__key"
          aria-label={`Decrease ${label}`}
          disabled={value <= min}
          onClick={() => onChange(clamp(value - step))}
        >
          −
        </button>
        <output class="stepper__value" aria-live="polite">
          {value}
          {unit ? <span class="stepper__unit">{unit}</span> : null}
        </output>
        <button
          type="button"
          class="stepper__key"
          aria-label={`Increase ${label}`}
          disabled={value >= max}
          onClick={() => onChange(clamp(value + step))}
        >
          +
        </button>
      </div>
    </div>
  );
}
