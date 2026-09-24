import type { WsEvent } from './types';

type Listener = (event: WsEvent) => void;

const listeners = new Set<Listener>();
let socket: WebSocket | null = null;
let reconnectTimer: number | null = null;
let pingTimer: number | null = null;
let attempts = 0;

export function subscribeSocket(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function emit(event: WsEvent): void {
  for (const listener of listeners) {
    try {
      listener(event);
    } catch (error) {
      console.warn('socket listener failed', error);
    }
  }
}

function clearTimers(): void {
  if (pingTimer !== null) {
    window.clearInterval(pingTimer);
    pingTimer = null;
  }
  if (reconnectTimer !== null) {
    window.clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(): void {
  if (reconnectTimer !== null) return;
  const delay = Math.min(5000, 400 * 2 ** Math.min(attempts, 4));
  attempts += 1;
  reconnectTimer = window.setTimeout(() => {
    reconnectTimer = null;
    connectSocket();
  }, delay);
}

export function connectSocket(): void {
  if (
    socket !== null &&
    (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)
  ) {
    return;
  }

  const scheme = window.location.protocol === 'https:' ? 'wss' : 'ws';
  const url = `${scheme}://${window.location.host}/ws`;

  try {
    socket = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }

  socket.onopen = () => {
    attempts = 0;
    emit({ type: 'socket', status: 'open' });
    pingTimer = window.setInterval(() => {
      if (socket !== null && socket.readyState === WebSocket.OPEN) socket.send('ping');
    }, 20000);
  };

  socket.onmessage = (message) => {
    if (typeof message.data !== 'string') return;
    try {
      emit(JSON.parse(message.data) as WsEvent);
    } catch {
      // Ignore anything that is not JSON; the protocol is defined by us.
    }
  };

  socket.onclose = () => {
    clearTimers();
    socket = null;
    emit({ type: 'socket', status: 'closed' });
    scheduleReconnect();
  };

  socket.onerror = () => {
    // The close handler does the recovery work.
  };
}
