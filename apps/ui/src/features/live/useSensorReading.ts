import { useEffect, useState } from 'react';
import type { ComponentDef, PinId } from '@ardudeck/core';
import { api } from '../../services/api';
import { liveValues } from '../../state/liveValues';
import { useStore } from '../../state/store';

export interface SensorReading {
  value: number | null;
  unit: string;
  ok: boolean;
}

/**
 * Reads one sensor: analog and digital pins stream through the watch list,
 * distance sensors are measured on demand (each ping is a physical event).
 */
export function useSensorReading(options: {
  def: ComponentDef | undefined;
  pins: Record<string, PinId | undefined>;
  pullup?: boolean;
  active: boolean;
}): SensorReading {
  const { def, pins, pullup = false, active } = options;
  const signalPin = pins['signal'];
  const trigPin = pins['trig'];
  const echoPin = pins['echo'];
  const isDistance = def?.reading?.kind === 'distance';
  const [distance, setDistance] = useState<number | null>(null);

  const streamed = useStore(liveValues, (state) =>
    !isDistance && signalPin ? (state[signalPin]?.value ?? null) : null,
  );

  useEffect(() => {
    if (!active || !def) return undefined;

    if (isDistance) {
      void api.watch([]).catch(() => undefined);
      if (!trigPin || !echoPin) return undefined;
      let cancelled = false;
      const measure = async () => {
        try {
          const result = await api.readDistance(trigPin, echoPin);
          if (!cancelled) setDistance(result.value);
        } catch {
          if (!cancelled) setDistance(null);
        }
      };
      void measure();
      const timer = window.setInterval(() => void measure(), 400);
      return () => {
        cancelled = true;
        window.clearInterval(timer);
      };
    }

    if (!signalPin) return undefined;
    const kind = def.reading?.kind === 'digital' ? 'digital' : 'analog';
    void api
      .watch([{ pin: signalPin, kind, pullup }])
      .catch(() => undefined);
    return () => {
      void api.watch([]).catch(() => undefined);
    };
  }, [active, def, signalPin, trigPin, echoPin, isDistance, pullup]);

  const value = isDistance ? distance : streamed;
  return {
    value,
    unit: def?.reading?.unit ?? '',
    ok: value !== null && !(isDistance && value < 0),
  };
}
