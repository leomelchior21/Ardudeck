import { useEffect, useRef, useState } from 'react';

export interface HoldHandlers {
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onPointerCancel: () => void;
}

/**
 * Press and hold to open Teacher Mode. Deliberate but reachable: a student
 * tapping the mark never triggers it by accident.
 */
export function useHoldToUnlock(action: () => void, durationMs = 5000): {
  holding: boolean;
  handlers: HoldHandlers;
} {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);

  const cancel = () => {
    setHolding(false);
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };

  const start = () => {
    cancel();
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      action();
    }, durationMs);
  };

  useEffect(() => () => cancel(), []);

  return {
    holding,
    handlers: {
      onPointerDown: start,
      onPointerUp: cancel,
      onPointerLeave: cancel,
      onPointerCancel: cancel,
    },
  };
}
