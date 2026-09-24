export interface ChoiceOption {
  value: string;
  label: string;
  hint?: string;
}

export interface ChoiceRowProps {
  label: string;
  options: readonly ChoiceOption[];
  value: string;
  onChange: (value: string) => void;
}

export function ChoiceRow({ label, options, value, onChange }: ChoiceRowProps) {
  return (
    <div className="field">
      <div className="field-label">{label}</div>
      <div className="choice-row">
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            className={`choice ${value === option.value ? 'choice--active' : ''}`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
      {options.find((option) => option.value === value)?.hint ? (
        <div className="hint">{options.find((option) => option.value === value)?.hint}</div>
      ) : null}
    </div>
  );
}
