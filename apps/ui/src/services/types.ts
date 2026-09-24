/** Shapes shared by the API client, the socket and the stores. */

export type HardwareState =
  | 'starting'
  | 'ready'
  | 'connecting'
  | 'disconnected'
  | 'needs-bridge'
  | 'deployed'
  | 'uploading'
  | 'no-arduino';

export interface HardwareStatus {
  state: HardwareState;
  source: string;
  board: string | null;
  port: string | null;
  detail: string | null;
}

export interface DeviceInfo {
  port: string;
  label: string;
  board: string | null;
  vid_pid: string | null;
  score: number;
  is_uno: boolean;
  is_candidate: boolean;
}

export interface ReadValue {
  id: string;
  name: string;
  value?: number;
  unit: string;
  ok: boolean;
}

export interface OutputState {
  nodeId: string;
  name: string;
  pin: string;
  op: string;
  state: string;
}

export interface RuntimeStatus {
  running: boolean;
  title: string | null;
  mode: 'simulated' | 'hardware' | null;
  source: string | null;
  tick: number;
  values: Record<string, ReadValue>;
  rules: Record<string, boolean>;
  outputs: Record<string, OutputState>;
}

export interface Health {
  status: string;
  app: string;
  version: string;
  apiVersion: number;
  mockMode: string;
  hardware: HardwareStatus;
  simulated: boolean;
  arduinoCli: { available: boolean; version: string | null; avrCore: boolean };
  bridge: { state: string; fqbn: string };
  runtime: { running: boolean };
  platform: Record<string, string | number>;
  piModel: string | null;
}

export interface DeployStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'ok' | 'error';
  message?: string;
  hints?: string[];
  details?: string;
}

export interface DeployJob {
  id: string;
  kind: 'deploy' | 'bridge';
  name: string;
  status: 'running' | 'ok' | 'error' | 'cancelled';
  steps: DeployStep[];
  startedAt: number;
  finishedAt: number | null;
  error: { message: string; hints: string[]; details: string } | null;
  result: { port: string; board: string } | null;
}

/** One block of a saved flow, resolved to names/icons from the registry. */
export interface ProjectComponent {
  id: string;
  pin?: string;
  value?: number;
}

export interface ProjectSummary {
  id: string;
  name: string;
  updatedAt: string;
  nodeCount: number;
  version?: number;
  components?: ProjectComponent[];
  deployedAt?: string;
}

export interface ProjectRecord {
  id: string;
  name: string;
  updatedAt: string;
  deployedAt: string | null;
  flow: unknown;
  code: string | null;
  malformed: boolean;
}

export interface TeacherSystem {
  app: { version: string; fqbn: string };
  platform: Record<string, string | number>;
  piModel: string | null;
  memory: { totalMb: number; availableMb: number } | null;
  temperatureC: number | null;
  uptimeSeconds: number | null;
  disk: { totalMb: number; freeMb: number } | null;
  arduinoCli: {
    executable: string;
    available: boolean;
    version: string | null;
    avrCore: boolean;
  };
  bridge: { sketch: string; present: boolean };
  hardware: { hardware: HardwareStatus; simulated: boolean; devices: DeviceInfo[] };
  deploy: DeployJob | null;
  webClients: number;
  paths: Record<string, string>;
}

export type WsEvent =
  | { type: 'hello'; hardware: HardwareStatus; simulated: boolean; mockMode: string; devices: DeviceInfo[]; runtime: RuntimeStatus }
  | { type: 'socket'; status: 'open' | 'closed' }
  | { type: 'hardware'; state: HardwareState; source: string; board: string | null; port: string | null; detail: string | null }
  | { type: 'values'; source: string; values: Record<string, { pin: string; kind: string; value: number }> }
  | { type: 'runtime'; running: boolean; values?: Record<string, ReadValue>; rules?: Record<string, boolean>; outputs?: Record<string, OutputState>; mode?: 'simulated' | 'hardware' | null; tick?: number }
  | { type: 'deploy'; job: DeployJob }
  | { type: 'serial'; direction: string; text: string; port: string }
  | { type: 'compile-log'; line: string }
  | { type: 'pong' };
