/**
 * Browser backend.
 *
 * The desktop product talks to a local Python service for hardware, runtime,
 * projects and deploy. On static hosting such as Vercel there is no service,
 * so this module runs the backend inside the tab: projects live in
 * localStorage, the runtime evaluates flows, and the board surface is either
 * the built-in simulation or a real Arduino the student granted over Web
 * Serial. Uploading a standalone program still needs the desktop toolchain.
 */
import { isPinId } from '@ardudeck/core';
import type { IrAction, IrCondition, IrProgram, IrRead } from '@ardudeck/core';
import { ApiError } from './errors';
import {
  enableDemoMode,
  getBackendMode,
  isDesktopShell,
  onDemoMode,
  setLiveMode,
} from './mode';
import {
  attachedSerialHardware,
  autoConnectSerial,
  flashBridgeFirmware,
} from './serial';
import type {
  BrowserHardwareBackend,
  BrowserWatch,
  DeployJob,
  DeployStep,
  DeviceInfo,
  HardwareStatus,
  Health,
  OutputState,
  ProjectComponent,
  ProjectRecord,
  ProjectSummary,
  ReadValue,
  RuntimeStatus,
  TeacherSystem,
  WsEvent,
} from './types';
import { publishLocal } from './ws';

const ANALOG_BASE = 550;
const ANALOG_DRIFT = 14;
const ANALOG_NOISE = 3;
const DISTANCE_DEFAULT_CM = 45;
const HARDWARE_TICK_MS = 50;
const VALUE_FLUSH_MS = 100;
const DISTANCE_EVERY_TICKS = 8;
const HEARTBEAT_MS = 200;
const MIN_LOOP_MS = 25;
const MAX_LOOP_MS = 80;
const PROJECTS_KEY = 'ardudeck.demo.projects';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function randomId(): string {
  return Math.random().toString(16).slice(2, 14);
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function actionSignature(action: IrAction): string {
  const entries = Object.entries(action)
    .filter(([key]) => key !== 'nodeId' && key !== 'name' && key !== 'var')
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0));
  return JSON.stringify(Object.fromEntries(entries));
}

function evaluate(value: number | null, condition: IrCondition, read: IrRead | null): boolean {
  if (condition.op === 'always') return true;
  if (value === null) return false;
  if (read !== null && read.kind === 'distance' && value < 0) return false;
  switch (condition.op) {
    case 'lt':
      return value < condition.value;
    case 'gt':
      return value > condition.value;
    case 'lte':
      return value <= condition.value;
    case 'gte':
      return value >= condition.value;
    case 'neq':
      return value !== condition.value;
    default:
      return value === condition.value;
  }
}

interface DemoValue {
  pin: string;
  kind: string;
  value: number;
}

function watchesFor(program: IrProgram): BrowserWatch[] {
  const watches: BrowserWatch[] = [];
  const seen = new Set<string>();
  for (const read of program.reads) {
    if (read.kind === 'distance' || read.pin === undefined) continue;
    if (seen.has(read.pin)) continue;
    seen.add(read.pin);
    watches.push({ pin: read.pin, kind: read.kind, pullup: read.pullup ?? false });
  }
  return watches;
}

class DemoHardware implements BrowserHardwareBackend {
  readonly simulated = true;
  readonly board = 'Simulated Arduino';
  readonly source = 'mock';

  private watches = new Map<string, BrowserWatch>();
  private analogBases = new Map<string, number>();
  private phases = new Map<string, number>();
  private analogValues = new Map<string, number>();
  private digitalValues = new Map<string, number>();
  private distanceBases = new Map<string, number>();
  private distanceValues = new Map<string, number>();
  private pending = new Map<string, DemoValue>();
  private timer: number | null = null;
  private lastFlush = 0;

  status(): HardwareStatus {
    return {
      state: 'ready',
      source: this.source,
      board: this.board,
      port: null,
      detail: 'Simulation mode - values are generated, not measured.',
    };
  }

  start(): void {
    if (this.timer !== null) return;
    this.timer = window.setInterval(() => this.tick(), HARDWARE_TICK_MS);
  }

  stop(): void {
    if (this.timer === null) return;
    window.clearInterval(this.timer);
    this.timer = null;
  }

  setWatches(watches: BrowserWatch[]): void {
    this.watches = new Map(watches.map((watch) => [watch.pin, watch]));
  }

  analog(pin: string): number | null {
    return this.analogValues.get(pin) ?? null;
  }

  digital(pin: string): number | null {
    return this.digitalValues.get(pin) ?? null;
  }

  distance(trig: string, echo: string): number | null {
    return this.distanceValues.get(`${trig}:${echo}`) ?? null;
  }

  distanceCm(trig: string, echo: string): number {
    const key = `${trig}:${echo}`;
    const base = this.distanceBases.get(key) ?? DISTANCE_DEFAULT_CM;
    const value = Math.round(Math.max(0, Math.min(400, base + Math.random() * 4 - 2)));
    this.distanceValues.set(key, value);
    return value;
  }

  setMockValue(rawPin: string, rawValue: number): { applied: boolean } {
    const pin = rawPin.toUpperCase();
    if (pin.startsWith('A')) {
      const base = Math.max(0, Math.min(1023, rawValue));
      this.analogBases.set(pin, base);
      this.pushValue(pin, 'analog', Math.round(base));
      return { applied: true };
    }
    const digital = rawValue ? 1 : 0;
    this.digitalValues.set(pin, digital);
    this.pushValue(pin, 'digital', digital);
    for (const key of [...this.distanceBases.keys()]) {
      if (key.startsWith(`${pin}:`)) {
        this.distanceBases.set(key, Math.max(0, Math.min(200, rawValue)));
      }
    }
    return { applied: true };
  }

  // The simulation has no electrical outputs; the runtime records their state.

  writeDigital(): void {}

  writePwm(): void {}

  writeServo(): void {}

  writeTone(): void {}

  stopTone(): void {}

  writeRgb(): void {}

  writeMotor(): void {}

  allSafe(): void {}

  private tick(): void {
    for (const watch of this.watches.values()) {
      if (watch.kind === 'analog') {
        this.pushValue(watch.pin, 'analog', this.analogValue(watch.pin));
      } else if (watch.kind === 'digital') {
        this.pushValue(watch.pin, 'digital', this.digitalValues.get(watch.pin) ?? 0);
      }
    }
  }

  private analogValue(pin: string): number {
    const base = this.analogBases.get(pin) ?? ANALOG_BASE;
    const phase = (this.phases.get(pin) ?? Math.random() * Math.PI * 2) + 0.04;
    this.phases.set(pin, phase);
    const value = base + ANALOG_DRIFT * Math.sin(phase) + (Math.random() * 2 - 1) * ANALOG_NOISE;
    return Math.round(Math.max(0, Math.min(1023, value)));
  }

  private pushValue(pin: string, kind: string, value: number): void {
    if (kind === 'analog') this.analogValues.set(pin, value);
    else if (kind === 'digital') this.digitalValues.set(pin, value);
    this.pending.set(pin, { pin, kind, value });
    const now = performance.now();
    if (now - this.lastFlush < VALUE_FLUSH_MS) return;
    this.lastFlush = now;
    const values = Object.fromEntries(this.pending);
    this.pending.clear();
    publishLocal({ type: 'values', source: this.source, values });
  }
}

class DemoRuntime {
  private readonly program: IrProgram;
  private readonly hardware: BrowserHardwareBackend;
  private readonly readsByVar = new Map<string, IrRead>();
  private values = new Map<string, ReadValue>();
  private truth = new Map<string, boolean>();
  private outputs = new Map<string, OutputState>();
  private applied = new Map<string, string>();
  private timer: number | null = null;
  private running = false;
  private tick = 0;
  private lastPublish = 0;

  constructor(program: IrProgram, hardware: BrowserHardwareBackend) {
    this.program = program;
    this.hardware = hardware;
    for (const read of program.reads) this.readsByVar.set(read.var, read);
  }

  start(): void {
    this.hardware.setWatches(watchesFor(this.program));
    this.running = true;
    this.schedule(0);
  }

  stop(): void {
    this.running = false;
    if (this.timer !== null) {
      window.clearTimeout(this.timer);
      this.timer = null;
    }
    this.hardware.allSafe();
    this.outputs.clear();
    this.applied.clear();
    this.publish(false);
  }

  status(): RuntimeStatus {
    return {
      running: this.running,
      title: this.program.title,
      mode: this.hardware.simulated ? 'simulated' : 'hardware',
      source: this.hardware.simulated ? 'mock' : 'hardware',
      tick: this.tick,
      values: Object.fromEntries(this.values),
      rules: Object.fromEntries(this.truth),
      outputs: Object.fromEntries(this.outputs),
    };
  }

  private schedule(delayMs: number): void {
    this.timer = window.setTimeout(() => this.runOnce(), delayMs);
  }

  private runOnce(): void {
    if (!this.running) return;
    const result = this.step();
    const now = performance.now();
    if (result.changed || now - this.lastPublish >= HEARTBEAT_MS) this.publish(true);
    const interval = Math.max(MIN_LOOP_MS, Math.min(this.program.loopDelayMs, MAX_LOOP_MS));
    this.schedule(interval + result.wait);
  }

  private step(): { changed: boolean; wait: number } {
    this.tick += 1;
    let changed = false;
    let wait = 0;

    for (const read of this.program.reads) {
      const value = this.readValue(read);
      const previous = this.values.get(read.id);
      const entry: ReadValue = {
        id: read.id,
        name: read.name,
        unit: read.kind === 'distance' ? 'cm' : '',
        ok: value !== null && !(read.kind === 'distance' && value < 0),
        value: value ?? undefined,
      };
      if (previous === undefined || previous.value !== entry.value) changed = true;
      this.values.set(read.id, entry);
    }

    for (const rule of this.program.rules) {
      const read = this.readsByVar.get(rule.var) ?? null;
      const entry = read !== null ? this.values.get(read.id) : undefined;
      const raw = entry?.value ?? null;
      const truth = evaluate(raw, rule.condition, read);
      if (this.truth.get(rule.id) !== truth) {
        this.truth.set(rule.id, truth);
        changed = true;
      }
      const applied = this.apply(truth ? rule.then : rule.else);
      if (applied.changed) changed = true;
      wait += applied.wait;
    }

    return { changed, wait };
  }

  private readValue(read: IrRead): number | null {
    if (read.kind === 'analog') return this.hardware.analog(read.pin ?? '');
    if (read.kind === 'digital') return this.hardware.digital(read.pin ?? '');
    if (this.tick % DISTANCE_EVERY_TICKS === 0) {
      return this.hardware.distanceCm(read.trigPin ?? '', read.echoPin ?? '');
    }
    return this.hardware.distance(read.trigPin ?? '', read.echoPin ?? '');
  }

  private apply(actions: IrAction[]): { changed: boolean; wait: number } {
    const looping = actions.some((action) => action.op === 'delay');
    let changed = false;
    let wait = 0;
    for (const action of actions) {
      const key = `${action.nodeId}:${action.op}`;
      const signature = actionSignature(action);
      if (!looping && this.applied.get(key) === signature) continue;
      this.applied.set(key, signature);
      wait += this.dispatch(action);
      changed = true;
    }
    return { changed, wait };
  }

  private dispatch(action: IrAction): number {
    let state = '?';
    let wait = 0;
    switch (action.op) {
      case 'digitalWrite':
        state = action.value ? 'ON' : 'OFF';
        if (action.pin) this.hardware.writeDigital(action.pin, action.value);
        break;
      case 'pwmWrite':
        state = `${action.value}`;
        if (action.pin) this.hardware.writePwm(action.pin, action.value);
        break;
      case 'servoWrite':
        state = `${action.angle} deg`;
        if (action.pin) this.hardware.writeServo(action.pin, action.angle);
        break;
      case 'tone':
        state = `${action.frequency} Hz`;
        if (action.pin) this.hardware.writeTone(action.pin, action.frequency, action.durationMs);
        break;
      case 'stopTone':
        state = 'silent';
        if (action.pin) this.hardware.stopTone(action.pin);
        break;
      case 'delay':
        wait = Math.max(0, Math.min(action.ms, 5000));
        state = `${wait} ms`;
        break;
      case 'rgbWrite':
        state =
          action.red === 0 && action.green === 0 && action.blue === 0
            ? 'OFF'
            : `RGB ${action.red},${action.green},${action.blue}`;
        this.hardware.writeRgb(
          action.redPin,
          action.greenPin,
          action.bluePin,
          action.red,
          action.green,
          action.blue,
        );
        break;
      case 'motorWrite':
        state =
          action.direction === 'stop' || action.direction === 'brake'
            ? 'OFF'
            : `${action.direction.toUpperCase()} ${action.speed}`;
        this.hardware.writeMotor(
          action.pin ?? '',
          action.in2Pin,
          action.enablePin,
          action.direction,
          action.speed,
        );
        break;
    }
    this.outputs.set(action.nodeId, {
      nodeId: action.nodeId,
      name: action.name,
      pin: action.pin ?? '',
      op: action.op,
      state,
    });
    return wait;
  }

  private publish(running: boolean): void {
    this.lastPublish = performance.now();
    const status = this.status();
    publishLocal({
      type: 'runtime',
      running,
      mode: status.mode,
      source: status.source,
      title: status.title,
      tick: status.tick,
      values: status.values,
      rules: status.rules,
      outputs: status.outputs,
    });
  }
}

class DemoJobs {
  private job: DeployJob | null = null;
  private generation = 0;

  current(): DeployJob | null {
    return this.job === null ? null : this.snapshot(this.job);
  }

  startBridge(): DeployJob {
    if (this.job !== null && this.job.status === 'running') {
      throw new ApiError(
        'An upload is already running.',
        'deploy-busy',
        'Wait for it to finish.',
        undefined,
        409,
      );
    }
    const job: DeployJob = {
      id: randomId(),
      kind: 'bridge',
      name: 'ArduDeck Bridge',
      status: 'running',
      steps: [
        { id: 'prepare', label: 'Preparing the bridge', status: 'pending' },
        { id: 'check', label: 'Checking hardware', status: 'pending' },
        { id: 'bridge', label: 'Installing on the Arduino', status: 'pending' },
        { id: 'finish', label: 'Ready', status: 'pending' },
      ],
      startedAt: Date.now() / 1000,
      finishedAt: null,
      error: null,
      result: null,
    };
    this.job = job;
    this.generation += 1;
    const generation = this.generation;
    this.publish();

    const isCurrent = () => generation === this.generation && job.status === 'running';

    window.setTimeout(() => {
      if (!isCurrent()) return;
      this.setStep(job, 'prepare', 'running');
      this.publish();
    }, 20);
    window.setTimeout(() => {
      if (!isCurrent()) return;
      this.setStep(job, 'prepare', 'ok', 'Bridge ready');
      this.setStep(job, 'check', 'ok', 'Arduino found');
      this.setStep(job, 'bridge', 'running');
      this.publish();
    }, 180);

    void flashBridgeFirmware(
      (progress) => {
        if (!isCurrent()) return;
        this.setStep(
          job,
          'bridge',
          'running',
          `${progress.status} ${Math.round(progress.percent)}%`,
        );
        this.publish();
      },
      (line) => {
        if (!isCurrent()) return;
        publishLocal({ type: 'compile-log', line });
      },
    )
      .then(() => {
        if (!isCurrent()) return;
        this.setStep(job, 'bridge', 'ok', 'Bridge installed');
        this.setStep(job, 'finish', 'ok', 'READY');
        job.status = 'ok';
        job.finishedAt = Date.now() / 1000;
        job.result = { port: 'USB', board: 'Arduino Uno' };
        this.publish();
      })
      .catch((error: unknown) => {
        if (!isCurrent()) return;
        const apiError = error instanceof ApiError ? error : null;
        const message = apiError?.message ?? 'The Arduino could not be prepared.';
        const hints = apiError?.hint !== undefined ? [apiError.hint] : [];
        this.setStep(job, 'bridge', 'error', message);
        job.status = 'error';
        job.finishedAt = Date.now() / 1000;
        job.error = { message, hints, details: apiError?.details ?? '' };
        this.publish();
      });

    return this.snapshot(job);
  }

  cancel(): DeployJob | null {
    this.generation += 1;
    const job = this.job;
    if (job !== null && job.status === 'running') {
      const step = job.steps.find((candidate) => candidate.status === 'running') ?? job.steps[0];
      if (step !== undefined) {
        step.status = 'error';
        step.message = 'Cancelled';
      }
      job.status = 'cancelled';
      job.finishedAt = Date.now() / 1000;
      this.publish();
    }
    return this.current();
  }

  private setStep(
    job: DeployJob,
    id: string,
    status: DeployStep['status'],
    message?: string,
  ): void {
    const step = job.steps.find((candidate) => candidate.id === id);
    if (step === undefined) return;
    step.status = status;
    if (message !== undefined) step.message = message;
  }

  private snapshot(job: DeployJob): DeployJob {
    return { ...job, steps: job.steps.map((step) => ({ ...step })) };
  }

  private publish(): void {
    if (this.job !== null) publishLocal({ type: 'deploy', job: this.snapshot(this.job) });
  }
}

interface StoredProject {
  id: string;
  name: string;
  updatedAt: string;
  deployedAt: string | null;
  flow: unknown;
  code: string | null;
}

function readProjects(): Map<string, StoredProject> {
  try {
    const raw = window.localStorage.getItem(PROJECTS_KEY);
    if (raw === null) return new Map();
    const parsed = JSON.parse(raw) as Record<string, StoredProject>;
    return new Map(Object.entries(parsed));
  } catch {
    return new Map();
  }
}

function writeProjects(projects: Map<string, StoredProject>): void {
  try {
    window.localStorage.setItem(PROJECTS_KEY, JSON.stringify(Object.fromEntries(projects)));
  } catch {
    throw new ApiError(
      'Projects cannot be saved in this browser.',
      'storage',
      'Private browsing may block local storage.',
    );
  }
}

function flowInfo(flow: unknown): {
  nodeCount: number;
  version: number;
  components: ProjectComponent[];
} {
  if (!isRecord(flow) || !Array.isArray(flow.nodes)) {
    return { nodeCount: 0, version: 1, components: [] };
  }
  const components: ProjectComponent[] = [];
  const seen = new Set<string>();
  for (const node of flow.nodes) {
    if (!isRecord(node)) continue;
    const componentId = node.componentId;
    if (typeof componentId !== 'string' || seen.has(componentId)) continue;
    seen.add(componentId);
    const config = isRecord(node.config) ? node.config : {};
    const pins = isRecord(config.pins) ? config.pins : {};
    const fields = isRecord(config.fields) ? config.fields : {};
    const pin = Object.values(pins).find((value): value is string => typeof value === 'string');
    const value = fields.value;
    const entry: ProjectComponent = { id: componentId };
    if (pin !== undefined) entry.pin = pin;
    if (typeof value === 'number') entry.value = value;
    components.push(entry);
  }
  const version = typeof flow.version === 'number' ? flow.version : 1;
  return { nodeCount: flow.nodes.length, version, components };
}

function toSummary(project: StoredProject): ProjectSummary {
  const info = flowInfo(project.flow);
  const summary: ProjectSummary = {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    nodeCount: info.nodeCount,
    version: info.version,
    components: info.components,
  };
  if (project.deployedAt !== null) summary.deployedAt = project.deployedAt;
  return summary;
}

function toRecord(project: StoredProject): ProjectRecord {
  return {
    id: project.id,
    name: project.name,
    updatedAt: project.updatedAt,
    deployedAt: project.deployedAt,
    flow: project.flow,
    code: project.code,
    malformed: false,
  };
}

const simulation = new DemoHardware();
const jobs = new DemoJobs();
let runtime: DemoRuntime | null = null;
let preferSimulation = false;

/** The board surface the runtime should use: a real Arduino, or simulation. */
function activeHardware(): BrowserHardwareBackend {
  if (!preferSimulation) {
    const serial = attachedSerialHardware();
    if (serial !== null) return serial;
  }
  return simulation;
}

function runtimeStatus(): RuntimeStatus {
  if (runtime !== null) return runtime.status();
  return {
    running: false,
    title: null,
    mode: null,
    source: null,
    tick: 0,
    values: {},
    rules: {},
    outputs: {},
  };
}

function hardwarePayload(): {
  ok: true;
  hardware: HardwareStatus;
  simulated: boolean;
  mockMode: string;
  devices: DeviceInfo[];
} {
  const backend = activeHardware();
  return {
    ok: true,
    hardware: backend.status(),
    simulated: backend.simulated,
    mockMode: backend.simulated ? 'demo' : 'web-serial',
    devices: [],
  };
}

function health(): Health {
  const backend = activeHardware();
  return {
    status: 'ok',
    app: 'ArduDeck',
    version: '0.1.0-demo',
    apiVersion: 1,
    mockMode: backend.simulated ? 'demo' : 'web-serial',
    hardware: backend.status(),
    simulated: backend.simulated,
    arduinoCli: { available: false, version: null, avrCore: false },
    bridge: { state: backend.status().state, fqbn: 'arduino:avr:uno' },
    runtime: { running: runtimeStatus().running },
    platform: {
      system: 'Browser',
      release: 'web',
      machine: 'browser',
      python: 'not available',
      hostname: window.location.hostname,
    },
    piModel: null,
  };
}

function setHardwareMode(mode: unknown): unknown {
  if (mode === 'off' || mode === 'auto') {
    const serial = attachedSerialHardware();
    if (mode === 'off' && serial === null) {
      throw new ApiError(
        'Connect your Arduino to start.',
        'no-hardware',
        'Click Connect Arduino and choose your board.',
      );
    }
    preferSimulation = false;
    const backend = activeHardware();
    return { ok: true, hardware: backend.status(), simulated: backend.simulated };
  }
  preferSimulation = true;
  return { ok: true, hardware: simulation.status(), simulated: true };
}

function watch(raw: unknown): { ok: true; watching: number } {
  const list = Array.isArray(raw) ? raw : [];
  const watches: BrowserWatch[] = [];
  for (const item of list) {
    if (!isRecord(item)) continue;
    const pin = typeof item.pin === 'string' ? item.pin.toUpperCase() : '';
    const kind = item.kind === 'digital' ? 'digital' : 'analog';
    if (!isPinId(pin)) {
      throw new ApiError(`${pin} is not a pin on the Arduino Uno.`, 'bad-pin');
    }
    watches.push({ pin, kind, pullup: item.pullup === true });
  }
  activeHardware().setWatches(watches);
  return { ok: true, watching: watches.length };
}

function readOnce(body: Record<string, unknown>): unknown {
  const backend = activeHardware();
  if (body.kind === 'distance') {
    const trig = typeof body.trig === 'string' ? body.trig.toUpperCase() : '';
    const echo = typeof body.echo === 'string' ? body.echo.toUpperCase() : '';
    if (!isPinId(trig) || !isPinId(echo)) {
      throw new ApiError('Choose pins for the distance sensor.', 'bad-pin');
    }
    return { ok: true, value: backend.distanceCm(trig, echo) };
  }
  if ((body.kind === 'analog' || body.kind === 'digital') && typeof body.pin === 'string') {
    const pin = body.pin.toUpperCase();
    if (!isPinId(pin)) {
      throw new ApiError(`${pin} is not a pin on the Arduino Uno.`, 'bad-pin');
    }
    return {
      ok: true,
      value: body.kind === 'analog' ? backend.analog(pin) : backend.digital(pin),
    };
  }
  throw new ApiError('This reading is not supported.', 'bad-kind');
}

function startRuntime(program: unknown, simulate: unknown): { ok: true; runtime: RuntimeStatus } {
  if (!isRecord(program) || !Array.isArray(program.reads) || !Array.isArray(program.rules)) {
    throw new ApiError('This flow could not be read.', 'invalid-flow', undefined, undefined, 400);
  }
  if (program.rules.length === 0) {
    throw new ApiError(
      'Add a condition and an action to your flow.',
      'invalid-flow',
      undefined,
      undefined,
      400,
    );
  }

  const backend = simulate === true ? simulation : activeHardware();
  if (!backend.simulated) {
    const state = backend.status().state;
    if (state === 'needs-bridge') {
      throw new ApiError(
        'Your Arduino needs to be prepared first.',
        'needs-bridge',
        'ArduDeck can install what it needs and try again.',
        undefined,
        409,
      );
    }
    if (state !== 'ready' && state !== 'deployed') {
      throw new ApiError(
        'The Arduino is not ready yet.',
        'not-ready',
        'Check the USB cable and try again.',
        undefined,
        409,
      );
    }
  }

  runtime?.stop();
  runtime = new DemoRuntime(program as unknown as IrProgram, backend);
  runtime.start();
  return { ok: true, runtime: runtime.status() };
}

function stopRuntime(): { ok: true; runtime: RuntimeStatus } {
  runtime?.stop();
  runtime = null;
  return { ok: true, runtime: runtimeStatus() };
}

function mockValue(body: Record<string, unknown>): {
  ok: true;
  applied: boolean;
  reason?: string;
} {
  const pin = typeof body.pin === 'string' ? body.pin.toUpperCase() : '';
  const value = typeof body.value === 'number' ? body.value : 0;
  if (!isPinId(pin)) {
    throw new ApiError(`${pin} is not a pin on the Arduino Uno.`, 'bad-pin');
  }
  return { ok: true, ...activeHardware().setMockValue(pin, value) };
}

function deploy(body: Record<string, unknown>): never {
  const code = typeof body.code === 'string' ? body.code : '';
  if (!code.includes('void setup') || !code.includes('void loop')) {
    throw new ApiError(
      'There is a problem in the code.',
      'invalid-code',
      'Open the code view and check the last change.',
      undefined,
      400,
    );
  }
  if (!activeHardware().simulated) {
    throw new ApiError(
      'This page can run a flow live, but cannot build standalone programs.',
      'no-compiler',
      'Use Test Live on the board, or open the Ardu OS desktop app to upload.',
      undefined,
      409,
    );
  }
  throw new ApiError(
    'Connect your Arduino to start.',
    'no-hardware',
    'Plug the Arduino in with the USB cable.',
    undefined,
    409,
  );
}

function listProjects(): ProjectSummary[] {
  const projects = [...readProjects().values()];
  projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
  return projects.map(toSummary);
}

function getProject(id: string): ProjectRecord {
  const project = readProjects().get(id);
  if (project === undefined) {
    throw new ApiError('This project could not be found.', 'not-found', undefined, undefined, 404);
  }
  return toRecord(project);
}

function saveProject(id: string, body: Record<string, unknown>): ProjectRecord {
  const flow = body.flow;
  if (typeof flow !== 'string' && !isRecord(flow)) {
    throw new ApiError('This project could not be saved.', 'invalid-project');
  }
  let parsedFlow: unknown = flow;
  if (typeof flow === 'string') {
    try {
      parsedFlow = JSON.parse(flow);
    } catch {
      throw new ApiError('This project could not be saved.', 'invalid-project');
    }
  }
  const projects = readProjects();
  const existing = projects.get(id);
  const name =
    typeof body.name === 'string' && body.name.trim().length > 0
      ? body.name.trim()
      : 'Untitled project';
  const stored: StoredProject = {
    id,
    name,
    updatedAt: new Date().toISOString(),
    deployedAt:
      typeof body.deployedAt === 'string' ? body.deployedAt : (existing?.deployedAt ?? null),
    flow: parsedFlow,
    code: typeof body.code === 'string' ? body.code : (existing?.code ?? null),
  };
  projects.set(id, stored);
  writeProjects(projects);
  return toRecord(stored);
}

function deleteProject(id: string): void {
  const projects = readProjects();
  if (!projects.delete(id)) {
    throw new ApiError('This project could not be found.', 'not-found', undefined, undefined, 404);
  }
  writeProjects(projects);
}

function teacherSystem(): TeacherSystem {
  const backend = activeHardware();
  return {
    app: { version: '0.1.0-demo', fqbn: 'arduino:avr:uno' },
    platform: {
      system: 'Browser',
      release: 'web',
      machine: 'browser',
      python: 'not available',
      hostname: window.location.hostname,
    },
    piModel: null,
    memory: null,
    temperatureC: null,
    uptimeSeconds: Math.round(performance.now() / 1000),
    disk: null,
    arduinoCli: {
      executable: 'not available in the browser',
      available: false,
      version: null,
      avrCore: false,
    },
    bridge: { sketch: 'firmware/ardudeck-bridge', present: !backend.simulated },
    hardware: { hardware: backend.status(), simulated: backend.simulated, devices: [] },
    deploy: jobs.current(),
    webClients: 1,
    paths: {},
  };
}

function installBridge(): { ok: true; job: DeployJob } {
  if (attachedSerialHardware() === null) {
    throw new ApiError(
      'Connect your Arduino to start.',
      'no-hardware',
      'Click Connect Arduino and choose your board.',
    );
  }
  return { ok: true, job: jobs.startBridge() };
}

function teacherLogs(kind: string): string[] {
  const stamp = new Date().toLocaleTimeString([], { hour12: false });
  if (kind === 'serial') {
    return [`${stamp}  demo  simulated serial link`];
  }
  if (kind === 'compile') {
    return [
      'Browser demo: arduino-cli is not available here.',
      'Deploy to a real Arduino from the Ardu OS desktop app.',
    ];
  }
  if (kind === 'events') {
    return [
      `${stamp}  hardware: state=ready source=mock`,
      `${stamp}  runtime: running=${runtimeStatus().running}`,
    ];
  }
  return [
    'ArduDeck browser demo',
    'No local service is running: hardware and the runtime are simulated in this tab.',
  ];
}

function parseBody(body: BodyInit | null | undefined): Record<string, unknown> {
  if (typeof body !== 'string' || body.length === 0) return {};
  try {
    const parsed = JSON.parse(body);
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function handle(
  method: string,
  pathname: string,
  query: URLSearchParams,
  body: Record<string, unknown>,
): unknown {
  if (pathname.startsWith('/api/projects/')) {
    const id = decodeURIComponent(pathname.slice('/api/projects/'.length));
    if (method === 'GET') return { ok: true, project: getProject(id) };
    if (method === 'PUT') return { ok: true, project: saveProject(id, body) };
    if (method === 'DELETE') {
      deleteProject(id);
      return { ok: true };
    }
  }

  switch (`${method} ${pathname}`) {
    case 'GET /api/health':
      return health();
    case 'GET /api/hardware':
      return hardwarePayload();
    case 'POST /api/hardware/mode':
      return setHardwareMode(body.mode);
    case 'POST /api/hardware/reconnect':
      return { ok: true, hardware: activeHardware().status() };
    case 'POST /api/hardware/use':
      return { ok: true, hardware: activeHardware().status() };
    case 'POST /api/hardware/watch':
      return watch(body.watches);
    case 'POST /api/hardware/install-bridge':
      return installBridge();
    case 'POST /api/hardware/read':
      return readOnce(body);
    case 'POST /api/runtime/start':
      return startRuntime(body.program, body.simulate);
    case 'POST /api/runtime/stop':
      return stopRuntime();
    case 'GET /api/runtime/status':
      return { ok: true, runtime: runtimeStatus() };
    case 'POST /api/runtime/mock-value':
      return mockValue(body);
    case 'POST /api/deploy':
      return deploy(body);
    case 'GET /api/deploy/current':
      return { ok: true, job: jobs.current() };
    case 'POST /api/deploy/cancel':
      return { ok: true, job: jobs.cancel() };
    case 'GET /api/projects':
      return { ok: true, projects: listProjects() };
    case 'GET /api/teacher/system':
      return { ok: true, system: teacherSystem() };
    case 'GET /api/teacher/logs':
      return {
        ok: true,
        kind: query.get('kind') ?? 'app',
        lines: teacherLogs(query.get('kind') ?? 'app'),
      };
    case 'POST /api/teacher/restart':
      return { ok: false, message: 'Restarting is only available on the Raspberry Pi.' };
    default:
      throw new ApiError(
        'ArduDeck is not responding.',
        'network',
        'This action is not available in the browser demo.',
      );
  }
}

/** Routes one API call to the in-browser simulation instead of the network. */
export async function demoRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? 'GET').toUpperCase();
  const url = new URL(path, window.location.origin);
  return handle(method, url.pathname, url.searchParams, parseBody(init.body)) as T;
}

async function probeService(): Promise<boolean> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 1500);
  try {
    const response = await fetch('/api/health', { signal: controller.signal });
    if (!response.ok) return false;
    const body = (await response.json()) as { status?: unknown; apiVersion?: unknown };
    return body.status === 'ok' && typeof body.apiVersion === 'number';
  } catch {
    return false;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Decides once, at startup, whether a real service is reachable. The desktop
 * shell always keeps its own backend; the browser falls back to the demo
 * simulation when no service answers.
 */
export async function resolveBackendMode(): Promise<void> {
  if (getBackendMode() !== 'unknown') return;
  if (isDesktopShell()) {
    setLiveMode();
    return;
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (await probeService()) {
      setLiveMode();
      return;
    }
    await delay(250);
  }
  enableDemoMode();
}

onDemoMode(() => {
  simulation.start();
  publishLocal({ type: 'socket', status: 'open' });
  const hello: WsEvent = {
    type: 'hello',
    hardware: simulation.status(),
    simulated: true,
    mockMode: 'demo',
    devices: [],
    runtime: runtimeStatus(),
  };
  publishLocal(hello);
  // A board the student granted before reconnects on its own, no dialog.
  void autoConnectSerial();
});
