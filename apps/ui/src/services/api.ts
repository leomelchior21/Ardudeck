import type {
  DeployJob,
  DeviceInfo,
  HardwareStatus,
  Health,
  ProjectRecord,
  ProjectSummary,
  RuntimeStatus,
  TeacherSystem,
} from './types';

export class ApiError extends Error {
  readonly code: string;
  readonly hint: string | undefined;
  readonly details: string | undefined;
  readonly status: number;

  constructor(
    message: string,
    code: string,
    hint?: string,
    details?: string,
    status = 0,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.hint = hint;
    this.details = details;
    this.status = status;
  }
}

interface ErrorBody {
  ok: false;
  error: { message?: string; code?: string; hint?: string; details?: string };
}

function isErrorBody(body: unknown): body is ErrorBody {
  if (typeof body !== 'object' || body === null) return false;
  const candidate = body as { ok?: unknown; error?: unknown };
  return candidate.ok === false && typeof candidate.error === 'object' && candidate.error !== null;
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
  } catch {
    throw new ApiError(
      'ArduDeck is not responding.',
      'network',
      'The local service may still be starting. Wait a moment and try again.',
    );
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  if (!response.ok || isErrorBody(body)) {
    if (isErrorBody(body)) {
      throw new ApiError(
        body.error.message ?? 'Something went wrong.',
        body.error.code ?? 'error',
        body.error.hint,
        body.error.details,
        response.status,
      );
    }
    throw new ApiError('Something went wrong.', 'http', undefined, undefined, response.status);
  }

  return body as T;
}

export interface WatchItem {
  pin: string;
  kind: 'analog' | 'digital';
  pullup?: boolean;
}

export const api = {
  health: () => request<Health>('/api/health'),

  hardware: () =>
    request<{
      ok: true;
      hardware: HardwareStatus;
      simulated: boolean;
      mockMode: string;
      devices: DeviceInfo[];
    }>('/api/hardware'),

  setHardwareMode: (mode: 'auto' | 'on' | 'off', port?: string) =>
    request<{ ok: true; hardware: HardwareStatus; simulated: boolean }>('/api/hardware/mode', {
      method: 'POST',
      body: JSON.stringify({ mode, port }),
    }),

  reconnectHardware: () =>
    request<{ ok: true; hardware: HardwareStatus }>('/api/hardware/reconnect', {
      method: 'POST',
    }),

  useHardware: (port: string) =>
    request<{ ok: true; hardware: HardwareStatus }>('/api/hardware/use', {
      method: 'POST',
      body: JSON.stringify({ port }),
    }),

  watch: (watches: WatchItem[]) =>
    request<{ ok: true; watching: number }>('/api/hardware/watch', {
      method: 'POST',
      body: JSON.stringify({ watches }),
    }),

  installBridge: () =>
    request<{ ok: true; job: DeployJob }>('/api/hardware/install-bridge', { method: 'POST' }),

  readDistance: (trig: string, echo: string) =>
    request<{ ok: true; value: number | null }>('/api/hardware/read', {
      method: 'POST',
      body: JSON.stringify({ kind: 'distance', trig, echo }),
    }),

  runtimeStart: (program: unknown, simulate: boolean) =>
    request<{ ok: true; runtime: RuntimeStatus }>('/api/runtime/start', {
      method: 'POST',
      body: JSON.stringify({ program, simulate }),
    }),

  runtimeStop: () =>
    request<{ ok: true; runtime: RuntimeStatus }>('/api/runtime/stop', { method: 'POST' }),

  runtimeStatus: () =>
    request<{ ok: true; runtime: RuntimeStatus }>('/api/runtime/status'),

  mockValue: (pin: string, value: number) =>
    request<{ ok: true; applied: boolean }>('/api/runtime/mock-value', {
      method: 'POST',
      body: JSON.stringify({ pin, value }),
    }),

  deploy: (name: string, code: string) =>
    request<{ ok: true; job: DeployJob }>('/api/deploy', {
      method: 'POST',
      body: JSON.stringify({ name, code }),
    }),

  deployCurrent: () => request<{ ok: true; job: DeployJob | null }>('/api/deploy/current'),

  deployCancel: () =>
    request<{ ok: true; job: DeployJob }>('/api/deploy/cancel', { method: 'POST' }),

  projects: () => request<{ ok: true; projects: ProjectSummary[] }>('/api/projects'),

  project: (id: string) =>
    request<{ ok: true; project: ProjectRecord }>(`/api/projects/${encodeURIComponent(id)}`),

  saveProject: (
    id: string,
    payload: { name: string; flow: unknown; code?: string | null; deployedAt?: string | null },
    keepalive = false,
  ) =>
    request<{ ok: true; project: ProjectRecord }>(`/api/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
      keepalive,
    }),

  deleteProject: (id: string) =>
    request<{ ok: true }>(`/api/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  teacherSystem: () => request<{ ok: true; system: TeacherSystem }>('/api/teacher/system'),

  teacherLogs: (kind: 'app' | 'serial' | 'compile' | 'events', lines = 200) =>
    request<{ ok: true; kind: string; lines: string[] }>(
      `/api/teacher/logs?kind=${kind}&lines=${lines}`,
    ),

  teacherRestart: () =>
    request<{ ok: boolean; message: string }>('/api/teacher/restart', { method: 'POST' }),
};
