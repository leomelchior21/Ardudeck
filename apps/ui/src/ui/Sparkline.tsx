export interface SparklineProps {
  samples: readonly number[];
  min: number;
  max: number;
  color?: string;
}

const WIDTH = 200;
const HEIGHT = 58;
const PADDING = 3;

/** Rolling history of a sensor. Plain SVG: cheap on a Raspberry Pi 3. */
export function Sparkline({ samples, min, max, color = 'var(--sensor)' }: SparklineProps) {
  const span = Math.max(1, max - min);
  const usable = samples.slice(-120);

  if (usable.length < 2) {
    return <svg className="sparkline" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" />;
  }

  const step = WIDTH / (usable.length - 1);
  const points = usable
    .map((value, index) => {
      const ratio = Math.max(0, Math.min(1, (value - min) / span));
      const y = HEIGHT - PADDING - ratio * (HEIGHT - PADDING * 2);
      return `${(index * step).toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  return (
    <svg
      className="sparkline"
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
