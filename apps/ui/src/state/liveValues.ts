import { subscribeSocket } from '../services/ws';
import { createStore } from './store';

export interface LiveValue {
  pin: string;
  kind: string;
  value: number;
}

/**
 * Raw pin values streamed from the backend while the Live Sensor screen is
 * open. The flow runtime keeps its own telemetry; this store is only for
 * watching a sensor directly.
 */
export const liveValues = createStore<Record<string, LiveValue>>({});

export function startLiveValuesSync(): void {
  subscribeSocket((event) => {
    if (event.type !== 'values') return;
    liveValues.set((state) => ({ ...state, ...event.values }));
  });
}
