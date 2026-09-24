/**
 * A real Arduino over Web Serial, for the hosted browser build.
 *
 * The desktop product talks to a local Python service that owns the USB port.
 * On a static page there is no service, so the tab itself becomes the host: a
 * student grants the browser access once, the ArduDeck Bridge firmware is
 * flashed from the page when the board does not have it, and from then on the
 * same line protocol the Python backend uses runs here.
 *
 * Web USB would require replacing the board's serial driver with WinUSB
 * (Zadig) on Windows, which breaks normal COM use. Web Serial has the same
 * explicit-permission model and works with the drivers students already have.
 */
import { BOARDS, STK500, WebSerialTransport } from 'webserial-flasher';
import { ApiError } from './errors';
import type {
  BrowserHardwareBackend,
  BrowserWatch,
  HardwareState,
  HardwareStatus,
  WsEvent,
} from './types';
import { publishLocal } from './ws';

const BAUD_RATE = 115200;
const HANDSHAKE_TIMEOUT_MS = 4000;
const HELLO_EVERY_MS = 500;
const PING_AFTER_SILENCE_MS = 3000;
const DROP_AFTER_SILENCE_MS = 8000;
const MEASURE_TIMEOUT_MS = 200;
const ECHO_INTERVAL_MS = 25;
const VALUE_FLUSH_MS = 100;
const TICK_MS = 50;
const PORT_LABEL = 'USB';
const BRIDGE_HEX_URL = `${import.meta.env.BASE_URL}firmware/ardudeck-bridge.hex`;

/** USB vendors that ship on Arduino boards and common clones. */
export const ARDUINO_USB_FILTERS = [
  { usbVendorId: 0x2341 },
  { usbVendorId: 0x2a03 },
  { usbVendorId: 0x1a86 },
  { usbVendorId: 0x10c4 },
  { usbVendorId: 0x0403 },
  { usbVendorId: 0x1b4f },
  { usbVendorId: 0x239a },
  { usbVendorId: 0x2e8a },
];

interface BridgeLine {
  kind:
    | 'boot'
    | 'ok'
    | 'analog'
    | 'digital'
    | 'value'
    | 'distance'
    | 'error'
    | 'pong'
    | 'unknown';
  pin?: string;
  value?: number;
  version?: string;
  text: string;
}

interface CachedValue {
  pin: string;
  kind: 'analog' | 'digital';
  value: number;
}

function parseIntOrNull(text: string | undefined): number | null {
  if (text === undefined) return null;
  const value = Number.parseInt(text, 10);
  return Number.isFinite(value) ? value : null;
}

function parseBridgeLine(raw: string): BridgeLine | null {
  const line = raw.trim();
  if (line.length === 0) return null;

  if (line.startsWith('ARDUDECK READY')) {
    const parts = line.split(/\s+/);
    return { kind: 'boot', version: parts[2], text: line };
  }
  if (line.startsWith('OK ARDUDECK')) {
    const parts = line.split(/\s+/);
    return { kind: 'ok', version: parts[2], text: line };
  }

  const parts = line.split(/\s+/);
  const tag = parts[0];
  if ((tag === 'A' || tag === 'D' || tag === 'V') && parts.length >= 3) {
    const value = parseIntOrNull(parts[2]);
    if (value === null) return { kind: 'unknown', text: line };
    const kind = tag === 'A' ? 'analog' : tag === 'D' ? 'digital' : 'value';
    return { kind, pin: parts[1] ?? '', value, text: line };
  }
  if (tag === 'C' && parts.length >= 2) {
    const value = parseIntOrNull(parts[1]);
    if (value === null) return { kind: 'unknown', text: line };
    return { kind: 'distance', value, text: line };
  }
  if (tag === 'ERR') return { kind: 'error', text: parts.slice(1).join(' ') };
  if (tag === 'PONG') {
    return { kind: 'pong', value: parseIntOrNull(parts[1]) ?? undefined, text: line };
  }
  return { kind: 'unknown', text: line };
}

function watchToken(watch: BrowserWatch): string {
  if (watch.kind === 'analog') return watch.pin;
  return watch.pullup ? `U${watch.pin.slice(1)}` : watch.pin;
}

/** One live Arduino over one Web Serial port. */
export class SerialBridge implements BrowserHardwareBackend {
  readonly simulated = false;
  readonly board = 'Arduino Uno';
  readonly port: ArdudeckSerialPort;

  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private state: HardwareState = 'connecting';
  private detail: string | null = null;
  private version: string | null = null;
  private watches: BrowserWatch[] = [];
  private values = new Map<string, CachedValue>();
  private distances = new Map<string, number>();
  private pending = new Map<string, CachedValue>();
  private measureResolve: ((value: number | null) => void) | null = null;
  private measurePending = false;
  private timer: number | null = null;
  private lastRx = 0;
  private helloAt = 0;
  private startedAt = 0;
  private lastFlush = 0;
  private closed = true;
  private flashing = false;

  constructor(port: ArdudeckSerialPort) {
    this.port = port;
  }

  get attached(): boolean {
    return this.flashing || !this.closed;
  }

  status(): HardwareStatus {
    return {
      state: this.state,
      source: 'hardware',
      board: this.board,
      port: PORT_LABEL,
      detail: this.detail,
    };
  }

  start(): void {
    // The port is opened when the student connects; nothing to start here.
  }

  stop(): void {
    void this.close();
  }

  async open(): Promise<void> {
    await this.port.open({ baudRate: BAUD_RATE, dataBits: 8, stopBits: 1, parity: 'none' });
    if (this.port.readable === null || this.port.writable === null) {
      await this.port.close();
      throw new Error('The serial port has no readable/writable streams.');
    }
    this.closed = false;
    this.state = 'connecting';
    this.detail = null;
    this.version = null;
    this.values.clear();
    this.distances.clear();
    this.pending.clear();
    this.reader = this.port.readable.getReader();
    this.writer = this.port.writable.getWriter();
    this.startedAt = performance.now();
    this.lastRx = this.startedAt;
    this.helloAt = 0;
    this.publishStatus();
    void this.readLoop();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
  }

  async close(): Promise<void> {
    this.closed = true;
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    const reader = this.reader;
    const writer = this.writer;
    this.reader = null;
    this.writer = null;
    try {
      await reader?.cancel();
    } catch {
      // The port may already be gone.
    }
    try {
      reader?.releaseLock();
    } catch {
      // Already released.
    }
    try {
      await writer?.close();
    } catch {
      // Nothing we can do while closing.
    }
    try {
      writer?.releaseLock();
    } catch {
      // Already released.
    }
    try {
      await this.port.close();
    } catch {
      // Already closed by the browser (cable unplugged).
    }
  }

  /** Used after the bridge firmware has been flashed. */
  async reopen(): Promise<void> {
    this.flashing = false;
    this.closed = true;
    this.state = 'connecting';
    this.detail = null;
    await this.open();
    await this.waitForHandshake(HANDSHAKE_TIMEOUT_MS + 500);
  }

  /** Resolves once the board answered, or once it is clearly not a bridge. */
  waitForHandshake(timeoutMs: number): Promise<void> {
    return new Promise((resolve) => {
      const started = performance.now();
      const check = () => {
        if (this.closed || this.state === 'ready' || this.state === 'needs-bridge') {
          resolve();
          return;
        }
        if (performance.now() - started >= timeoutMs) {
          resolve();
          return;
        }
        window.setTimeout(check, 100);
      };
      check();
    });
  }

  setStatusForFlash(detail: string): void {
    this.flashing = true;
    this.state = 'uploading';
    this.detail = detail;
    this.publishStatus();
  }

  notifyDisconnected(reason: string): void {
    this.state = 'disconnected';
    this.detail = reason;
    this.publishStatus();
  }

  // ------------------------------------------------------------- readings

  setWatches(watches: BrowserWatch[]): void {
    this.watches = watches;
    if (this.state === 'ready') this.applyWatches();
  }

  analog(pin: string): number | null {
    const entry = this.values.get(pin);
    return entry !== undefined && entry.kind === 'analog' ? entry.value : null;
  }

  digital(pin: string): number | null {
    const entry = this.values.get(pin);
    return entry !== undefined && entry.kind === 'digital' ? entry.value : null;
  }

  distance(trig: string, echo: string): number | null {
    return this.distances.get(`${trig}:${echo}`) ?? null;
  }

  distanceCm(trig: string, echo: string): number | null {
    if (this.state !== 'ready') return null;
    const key = `${trig}:${echo}`;
    this.requestMeasure(trig, echo, key);
    return this.distances.get(key) ?? null;
  }

  private requestMeasure(trig: string, echo: string, key: string): void {
    if (this.measurePending) return;
    this.measurePending = true;
    let settled = false;
    const timer = window.setTimeout(() => finish(null), MEASURE_TIMEOUT_MS);
    const finish = (value: number | null) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      this.measurePending = false;
      this.measureResolve = null;
      if (value !== null) this.distances.set(key, value);
    };
    this.measureResolve = finish;
    if (!this.send(`M ${trig} ${echo}`)) finish(null);
  }

  setMockValue(): { applied: boolean; reason?: string } {
    return { applied: false, reason: 'hardware' };
  }

  // ------------------------------------------------------------- outputs

  writeDigital(pin: string, value: number): void {
    this.send(`W ${pin} ${value ? 1 : 0}`);
  }

  writePwm(pin: string, value: number): void {
    this.send(`P ${pin} ${Math.round(value)}`);
  }

  writeServo(pin: string, angle: number): void {
    this.send(`S ${pin} ${Math.round(angle)}`);
  }

  writeTone(pin: string, frequency: number, durationMs: number): void {
    this.send(`T ${pin} ${Math.round(frequency)} ${Math.round(durationMs)}`);
  }

  stopTone(pin: string): void {
    this.send(`N ${pin}`);
  }

  writeRgb(
    redPin: string,
    greenPin: string,
    bluePin: string,
    red: number,
    green: number,
    blue: number,
  ): void {
    this.writePwm(redPin, red);
    this.writePwm(greenPin, green);
    this.writePwm(bluePin, blue);
  }

  writeMotor(
    in1Pin: string,
    in2Pin: string,
    enablePin: string,
    direction: string,
    speed: number,
  ): void {
    if (direction === 'forward') {
      this.writeDigital(in1Pin, 1);
      this.writeDigital(in2Pin, 0);
      this.writePwm(enablePin, speed);
    } else if (direction === 'reverse') {
      this.writeDigital(in1Pin, 0);
      this.writeDigital(in2Pin, 1);
      this.writePwm(enablePin, speed);
    } else if (direction === 'brake') {
      this.writeDigital(in1Pin, 1);
      this.writeDigital(in2Pin, 1);
      this.writePwm(enablePin, 255);
    } else {
      this.writeDigital(in1Pin, 0);
      this.writeDigital(in2Pin, 0);
      this.writePwm(enablePin, 0);
    }
  }

  allSafe(): void {
    this.send('X');
  }

  // ------------------------------------------------------------- internals

  private publishStatus(): void {
    const status = this.status();
    const event: WsEvent = {
      type: 'hardware',
      state: status.state,
      source: status.source,
      board: status.board,
      port: status.port,
      detail: status.detail,
    };
    publishLocal(event);
  }

  private applyWatches(): void {
    const tokens = this.watches.map(watchToken).join(',');
    this.send(tokens.length > 0 ? `E ${tokens}` : 'E');
    this.send(`e ${ECHO_INTERVAL_MS}`);
  }

  private send(line: string): boolean {
    const writer = this.writer;
    if (writer === null || this.closed) return false;
    try {
      void writer.write(new TextEncoder().encode(`${line}\n`));
    } catch {
      return false;
    }
    this.publishSerial('->', line);
    return true;
  }

  private publishSerial(direction: string, text: string): void {
    const event: WsEvent = { type: 'serial', direction, text, port: PORT_LABEL };
    publishLocal(event);
  }

  private async readLoop(): Promise<void> {
    const reader = this.reader;
    if (reader === null) return;
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        let index = buffer.indexOf('\n');
        while (index >= 0) {
          const line = buffer.slice(0, index).replace(/\r$/, '');
          buffer = buffer.slice(index + 1);
          if (line.trim().length > 0) this.handleLine(line);
          index = buffer.indexOf('\n');
        }
      }
    } catch {
      if (!this.closed) this.notifyDisconnected('Arduino disconnected');
      return;
    }
    if (!this.closed) this.notifyDisconnected('Arduino disconnected');
  }

  private handleLine(text: string): void {
    this.lastRx = performance.now();
    const message = parseBridgeLine(text);
    if (message === null) return;

    if (message.kind !== 'analog' && message.kind !== 'digital' && message.kind !== 'value') {
      this.publishSerial('<-', text);
    }

    if (message.kind === 'boot') {
      this.version = message.version ?? this.version;
      if (this.state !== 'ready') this.send('?');
      return;
    }
    if (message.kind === 'ok') {
      this.version = message.version ?? this.version;
      if (this.state !== 'ready') {
        this.state = 'ready';
        this.detail = `Bridge ${this.version ?? '?'}`;
        this.publishStatus();
        this.applyWatches();
      }
      return;
    }
    if (message.kind === 'analog' || message.kind === 'digital' || message.kind === 'value') {
      if (message.pin === undefined || message.value === undefined) return;
      const kind = message.kind === 'value' ? (message.pin.startsWith('A') ? 'analog' : 'digital') : message.kind;
      this.pending.set(message.pin, { pin: message.pin, kind, value: message.value });
      return;
    }
    if (message.kind === 'distance') {
      if (message.value !== undefined) this.measureResolve?.(message.value);
      return;
    }
  }

  private flushValues(): void {
    const now = performance.now();
    if (this.pending.size === 0 || now - this.lastFlush < VALUE_FLUSH_MS) return;
    this.lastFlush = now;
    const values = Object.fromEntries(this.pending);
    for (const [pin, entry] of this.pending) this.values.set(pin, entry);
    this.pending.clear();
    const event: WsEvent = { type: 'values', source: 'hardware', values };
    publishLocal(event);
  }

  private tick(): void {
    if (this.closed) return;
    const now = performance.now();
    this.flushValues();

    if (this.state === 'ready') {
      if (now - this.lastRx > PING_AFTER_SILENCE_MS && now - this.helloAt > 1500) {
        this.helloAt = now;
        this.send('?');
      }
      if (now - this.lastRx > DROP_AFTER_SILENCE_MS) {
        this.notifyDisconnected('Arduino stopped responding');
      }
      return;
    }

    if (this.state === 'connecting' || this.state === 'uploading') {
      if (now - this.helloAt > HELLO_EVERY_MS && this.state === 'connecting') {
        this.helloAt = now;
        this.send('?');
      }
      if (this.state === 'connecting' && now - this.startedAt > HANDSHAKE_TIMEOUT_MS) {
        this.state = 'needs-bridge';
        this.detail = 'Arduino found, but ArduDeck Bridge is not installed.';
        this.publishStatus();
      }
    }
  }
}

let controller: SerialBridge | null = null;
let disconnectListener = false;

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && navigator.serial !== undefined;
}

/** The attached board, if the student has already granted one. */
export function activeSerial(): SerialBridge | null {
  return controller;
}

/** The backend the browser runtime should use: the board, or the simulation. */
export function attachedSerialHardware(): BrowserHardwareBackend | null {
  return controller !== null && controller.attached ? controller : null;
}

function ensureDisconnectListener(): void {
  if (disconnectListener || !isWebSerialSupported()) return;
  disconnectListener = true;
  navigator.serial?.addEventListener('disconnect', (event: Event) => {
    const port = event.target as unknown as ArdudeckSerialPort;
    if (controller !== null && controller.port === port) {
      controller.notifyDisconnected('Arduino disconnected');
    }
  });
}

async function attach(port: ArdudeckSerialPort): Promise<SerialBridge> {
  const previous = controller;
  if (previous !== null) await previous.close();
  const bridge = new SerialBridge(port);
  controller = bridge;
  try {
    await bridge.open();
  } catch (error) {
    controller = previous;
    throw error;
  }
  await bridge.waitForHandshake(HANDSHAKE_TIMEOUT_MS + 500);
  return bridge;
}

/**
 * Must be called from a click: the browser shows its device picker and the
 * student explicitly grants this page access to the board.
 */
export async function connectArduinoPort(): Promise<HardwareStatus> {
  if (!isWebSerialSupported()) {
    throw new ApiError(
      'This browser cannot talk to USB.',
      'web-serial-unsupported',
      'Use Chrome or Edge on a computer, or open the Ardu OS app.',
    );
  }
  ensureDisconnectListener();

  let port: ArdudeckSerialPort;
  try {
    port = await navigator.serial!.requestPort({ filters: ARDUINO_USB_FILTERS });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'NotFoundError') {
      throw new ApiError('No board was chosen.', 'cancelled', 'Click Connect Arduino again.');
    }
    throw new ApiError(
      'The browser could not open the device picker.',
      'serial-request',
      'Make sure another tab or program is not using the board.',
    );
  }

  try {
    const bridge = await attach(port);
    return bridge.status();
  } catch (error) {
    throw new ApiError(
      'The serial port could not be opened.',
      'serial-open',
      'Close any program using the port (Arduino IDE, serial monitor) and try again.',
      error instanceof Error ? error.message : undefined,
    );
  }
}

/**
 * Reconnects a board the student already granted before, without any dialog.
 * Safe to call on every page load.
 */
export async function autoConnectSerial(): Promise<void> {
  if (!isWebSerialSupported() || controller !== null) return;
  ensureDisconnectListener();
  let ports: ArdudeckSerialPort[] = [];
  try {
    ports = await navigator.serial!.getPorts();
  } catch {
    return;
  }
  for (const port of ports) {
    try {
      await attach(port);
      return;
    } catch {
      // Try the next granted port.
    }
  }
}

export interface BridgeFlashProgress {
  status: string;
  percent: number;
}

type TransportSignals = { dtr?: boolean; rts?: boolean; brk?: boolean };

/** The flasher uses Node-style signal names; Web Serial wants the spec names. */
function mapTransportSignals(transport: WebSerialTransport): void {
  const target = transport as unknown as {
    port: ArdudeckSerialPort;
    setSignals: (signals: TransportSignals) => Promise<void>;
  };
  target.setSignals = async (signals: TransportSignals) => {
    const mapped: ArdudeckSerialPortSignals = {};
    if (signals.dtr !== undefined) mapped.dataTerminalReady = signals.dtr;
    if (signals.rts !== undefined) mapped.requestToSend = signals.rts;
    if (signals.brk !== undefined) mapped.break = signals.brk;
    await target.port.setSignals(mapped);
  };
}

/**
 * Flashes the ArduDeck Bridge firmware onto the attached board, straight from
 * the page. The student already granted the port; nothing else is needed.
 */
export async function flashBridgeFirmware(
  onProgress: (progress: BridgeFlashProgress) => void,
  logLine: (line: string) => void,
): Promise<void> {
  const bridge = controller;
  if (bridge === null) {
    throw new ApiError(
      'Connect your Arduino to start.',
      'no-hardware',
      'Click Connect Arduino and choose your board.',
    );
  }
  if (!bridge.attached) {
    await bridge.reopen();
  }

  const port = bridge.port;
  bridge.setStatusForFlash('Installing ArduDeck Bridge');
  await bridge.close();

  let failure: unknown = null;
  try {
    const transport = new WebSerialTransport(port);
    mapTransportSignals(transport);
    await transport.open(BAUD_RATE);

    const board = BOARDS['arduino-uno'];
    if (board === undefined) throw new Error('The Arduino Uno board definition is missing.');
    const stk = new STK500(transport, board, {
      quiet: true,
      logger: (_level, message) => logLine(message),
    });

    const response = await fetch(BRIDGE_HEX_URL);
    if (!response.ok) {
      throw new Error(`Bridge firmware is not available (${response.status}).`);
    }
    const hex = await response.text();

    onProgress({ status: 'Resetting the Arduino', percent: 0 });
    await stk.bootload(hex, (status, percent) => onProgress({ status, percent }));
    await transport.close();
  } catch (error) {
    failure = error;
  } finally {
    try {
      await bridge.reopen();
    } catch {
      bridge.notifyDisconnected('Arduino disconnected');
    }
  }

  if (failure !== null) {
    const message = failure instanceof Error ? failure.message : 'The upload did not finish.';
    throw new ApiError(
      'The Arduino could not be prepared.',
      'bridge-flash',
      'Check the USB cable, close other programs using the board, and try again.',
      message,
    );
  }

  if (bridge.status().state !== 'ready') {
    throw new ApiError(
      'The Arduino did not answer after the update.',
      'bridge-handshake',
      'Unplug the USB cable, plug it back in, and try again.',
    );
  }
}
