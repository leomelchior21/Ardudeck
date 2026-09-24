export interface NumberStepperProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit?: string;
  onChange: (value: number) => void;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Coarse control by dragging, fine control by tapping: works well with a
 * finger on a 7 inch screen, where a 0-1023 number cannot be typed easily.
 */
export function NumberStepper({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: NumberStepperProps) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="stepper">
        <button
          type="button"
          className="stepper-btn"
          onClick={() => onChange(clamp(value - step, min, max))}
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <div className="stepper-value">
          {Math.round(value)}
          {unit ? <span className="readout-unit"> {unit}</span> : null}
        </div>
        <button
          type="button"
          className="stepper-btn"
          onClick={() => onChange(clamp(value + step, min, max))}
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
      <input
        className="slider"
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <div className="meter-scale">
        <span>{min}</span>
        <span>{Math.round((min + max) / 2)}</span>
        <span>{max}</span>
      </div>
    </div>
  );
}
