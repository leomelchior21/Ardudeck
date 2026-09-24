/**
 * Minimal Web Serial typings. Chrome and Edge ship the API; TypeScript's DOM
 * library does not describe it yet, so the shapes we use live here.
 */
export {};

declare global {
  interface ArdudeckSerialPortInfo {
    usbVendorId?: number;
    usbProductId?: number;
  }

  interface ArdudeckSerialPortSignals {
    dataTerminalReady?: boolean;
    requestToSend?: boolean;
    break?: boolean;
  }

  interface ArdudeckSerialPortOpenOptions {
    baudRate: number;
    dataBits?: number;
    stopBits?: number;
    parity?: 'none' | 'even' | 'odd';
    bufferSize?: number;
    flowControl?: 'none' | 'hardware';
  }

  interface ArdudeckSerialPort extends EventTarget {
    readonly readable: ReadableStream<Uint8Array> | null;
    readonly writable: WritableStream<Uint8Array> | null;
    getInfo(): ArdudeckSerialPortInfo;
    open(options: ArdudeckSerialPortOpenOptions): Promise<void>;
    close(): Promise<void>;
    setSignals(signals: ArdudeckSerialPortSignals): Promise<void>;
  }

  interface ArdudeckSerial extends EventTarget {
    getPorts(): Promise<ArdudeckSerialPort[]>;
    requestPort(options?: { filters?: ArdudeckSerialPortInfo[] }): Promise<ArdudeckSerialPort>;
  }

  interface Navigator {
    readonly serial?: ArdudeckSerial;
  }
}
