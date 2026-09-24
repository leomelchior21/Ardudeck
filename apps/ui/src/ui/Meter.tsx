export interface MeterProps {
  value: number | null;
  min: number;
  max: number;
  color?: string;
}

export function Meter({ value, min, max, color = 'var(--sensor)' }: MeterProps) {
  const span = Math.max(1, max - min);
  const ratio = value === null ? 0 : Math.max(0, Math.min(1, (value - min) / span));
  return (
    <div className="meter">
      <div
        className="meter-fill"
        style={{ width: `${(ratio * 100).toFixed(1)}%`, background: color }}
      />
    </div>
  );
}
