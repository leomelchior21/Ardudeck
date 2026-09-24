/**
 * Which backend the UI talks to. It starts as `unknown`, then becomes `live`
 * (the local ArduDeck service) or `demo` (the in-browser simulation used on
 * static hosting such as Vercel, where no Python service exists).
 */
export type BackendMode = 'unknown' | 'live' | 'demo';

let mode: BackendMode = 'unknown';
const listeners = new Set<() => void>();

export function getBackendMode(): BackendMode {
  return mode;
}

export function isDemoMode(): boolean {
  return mode === 'demo';
}

/** The Electron shell always has its own backend; it never falls back. */
export function isDesktopShell(): boolean {
  return typeof window !== 'undefined' && window.arduOS?.desktop === true;
}

export function setLiveMode(): void {
  if (mode === 'unknown') mode = 'live';
}

export function enableDemoMode(): void {
  if (mode === 'demo') return;
  mode = 'demo';
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      console.warn('demo mode listener failed', error);
    }
  }
}

export function onDemoMode(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
