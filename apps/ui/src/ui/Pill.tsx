import type { ReactNode } from 'react';
import { describeHardware, hardware as hardwareStore } from '../state/hardware';
import type { StatusTone } from '../state/hardware';
import { useStore } from '../state/store';

export function Pill({
  tone = 'muted',
  children,
  className,
}: {
  tone?: StatusTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={`pill pill--${tone} ${className ?? ''}`.trim()}>{children}</span>
  );
}

export function HardwarePill() {
  const status = useStore(hardwareStore, (state) => state.hardware);
  const simulated = useStore(hardwareStore, (state) => state.simulated);
  const mockMode = useStore(hardwareStore, (state) => state.mockMode);
  const { label, tone } = describeHardware(status, simulated, mockMode);
  return (
    <Pill tone={tone}>
      <span className="dot" />
      {label}
    </Pill>
  );
}
