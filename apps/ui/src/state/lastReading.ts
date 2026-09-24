import type { NodeComponentId, PinId } from '@ardudeck/core';
import { createStore } from './store';

/**
 * The last value a student physically observed and chose with
 * "USE CURRENT VALUE". It is offered as a shortcut in condition settings.
 */
export interface LastReading {
  componentId: NodeComponentId;
  pins: Record<string, PinId>;
  value: number;
  at: number;
}

export const lastReading = createStore<LastReading | null>(null);

export function rememberReading(reading: LastReading): void {
  lastReading.set({ ...reading, at: Date.now() });
}
