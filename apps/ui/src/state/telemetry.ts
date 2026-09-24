import type { OutputState, ReadValue, RuntimeStatus } from '../services/types';
import { subscribeSocket } from '../services/ws';
import { createStore } from './store';

export interface TelemetryState {
  running: boolean;
  mode: 'simulated' | 'hardware' | null;
  tick: number;
  values: Record<string, ReadValue>;
  rules: Record<string, boolean>;
  outputs: Record<string, OutputState>;
}

const EMPTY: TelemetryState = {
  running: false,
  mode: null,
  tick: 0,
  values: {},
  rules: {},
  outputs: {},
};

export const telemetry = createStore<TelemetryState>(EMPTY);

export function applyRuntime(runtime: Partial<RuntimeStatus> & { running: boolean }): void {
  telemetry.set({
    running: runtime.running,
    mode: runtime.mode ?? null,
    tick: runtime.tick ?? 0,
    values: runtime.values ?? {},
    rules: runtime.rules ?? {},
    outputs: runtime.outputs ?? {},
  });
}

export function clearTelemetry(): void {
  telemetry.set(EMPTY);
}

export function startTelemetrySync(): void {
  subscribeSocket((event) => {
    if (event.type === 'runtime') {
      applyRuntime(event);
      return;
    }
    if (event.type === 'hello') {
      applyRuntime(event.runtime);
    }
  });
}
