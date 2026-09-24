import { api } from '../services/api';
import type { DeviceInfo, HardwareStatus, WsEvent } from '../services/types';
import { connectSocket, subscribeSocket } from '../services/ws';
import { createStore } from './store';

export interface HardwareStoreState {
  apiReachable: boolean;
  loaded: boolean;
  hardware: HardwareStatus;
  simulated: boolean;
  mockMode: string;
  devices: DeviceInfo[];
  socket: 'connecting' | 'open' | 'closed';
}

const UNKNOWN: HardwareStatus = {
  state: 'connecting',
  source: 'none',
  board: null,
  port: null,
  detail: null,
};

export const hardware = createStore<HardwareStoreState>({
  apiReachable: true,
  loaded: false,
  hardware: UNKNOWN,
  simulated: false,
  mockMode: 'auto',
  devices: [],
  socket: 'connecting',
});

function applyStatus(
  status: HardwareStatus,
  simulated: boolean,
  devices?: DeviceInfo[],
  mockMode?: string,
): void {
  hardware.set((state) => ({
    ...state,
    loaded: true,
    hardware: status,
    simulated,
    devices: devices ?? state.devices,
    mockMode: mockMode ?? state.mockMode,
  }));
}

export async function refreshHardware(): Promise<void> {
  try {
    const payload = await api.hardware();
    hardware.set((state) => ({ ...state, apiReachable: true }));
    applyStatus(payload.hardware, payload.simulated, payload.devices, payload.mockMode);
  } catch {
    hardware.set((state) => ({ ...state, apiReachable: false }));
  }
}

function handleEvent(event: WsEvent): void {
  if (event.type === 'socket') {
    hardware.set((state) => ({ ...state, socket: event.status }));
    if (event.status === 'open') void refreshHardware();
    return;
  }
  if (event.type === 'hello') {
    applyStatus(event.hardware, event.simulated, event.devices, event.mockMode);
    return;
  }
  if (event.type === 'hardware') {
    applyStatus(
      {
        state: event.state,
        source: event.source,
        board: event.board,
        port: event.port,
        detail: event.detail,
      },
      event.source === 'mock',
    );
  }
}

export function startHardwareSync(): void {
  connectSocket();
  subscribeSocket(handleEvent);
  void refreshHardware();
  window.setInterval(() => {
    if (hardware.get().socket !== 'open') void refreshHardware();
  }, 15000);
}

export type StatusTone = 'ok' | 'warn' | 'danger' | 'muted' | 'sim' | 'accent';

export interface HardwareDescription {
  label: string;
  tone: StatusTone;
}

export function describeHardware(
  status: HardwareStatus,
  simulated: boolean,
  mockMode = 'auto',
): HardwareDescription {
  if (simulated) {
    // A student who pressed "Try simulation" gets an honest SIMULATED label;
    // otherwise the chip answers the only question that matters: is an
    // Arduino connected? (The hosted browser demo can never reach a board.)
    if (mockMode === 'on') return { label: 'Simulation', tone: 'sim' };
    return { label: 'No Arduino', tone: 'muted' };
  }
  switch (status.state) {
    case 'ready':
      return { label: 'Arduino Ready', tone: 'ok' };
    case 'deployed':
      return { label: 'Program running', tone: 'ok' };
    case 'connecting':
      return { label: 'Connecting...', tone: 'accent' };
    case 'uploading':
      return { label: 'Sending...', tone: 'accent' };
    case 'needs-bridge':
      return { label: 'Arduino needs setup', tone: 'warn' };
    case 'disconnected':
      return { label: 'Arduino disconnected', tone: 'danger' };
    case 'no-arduino':
      return { label: 'No Arduino', tone: 'muted' };
    default:
      return { label: 'Starting...', tone: 'muted' };
  }
}

/** True when real hardware is connected, ready and not simulating. */
export function hasRealHardware(): boolean {
  const state = hardware.get();
  return state.hardware.state === 'ready' && !state.simulated;
}
