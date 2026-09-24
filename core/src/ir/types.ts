import type { PinId } from '../components/pins';

export type IrReadKind = 'analog' | 'digital' | 'distance';

/**
 * The Intermediate Representation is the frozen contract between the visual
 * editor and everything that consumes a flow: the live runtime (Python) and
 * the Arduino code generator (TypeScript).
 *
 * It is a flat list of sensor reads and rules. Every rule reads one value,
 * compares it, and optionally drives actions. This is deliberately the
 * smallest shape that still expresses the classroom sequence
 * "observe -> rule -> act", and it maps 1:1 to generated C++.
 */
export interface IrRead {
  /** Id of the sensor graph node that produced this read. */
  id: string;
  /** Student-facing component name, used in generated comments and logs. */
  name: string;
  /** Safe C-style identifier used for generated variable names. */
  var: string;
  kind: IrReadKind;
  pin?: PinId;
  trigPin?: PinId;
  echoPin?: PinId;
  pullup?: boolean;
}

export interface IrCondition {
  op: 'lt' | 'gt' | 'eq' | 'lte' | 'gte' | 'neq';
  value: number;
}

export interface IrActionBase {
  /** Id of the actuator graph node that produced this action. */
  nodeId: string;
  /** Student-facing component name, used in generated comments and logs. */
  name: string;
  /** Safe C-style identifier base for generated names. */
  var: string;
  /** Physical pin. Timing actions like Delay have no pin. */
  pin?: PinId;
}

export type IrAction =
  | (IrActionBase & { op: 'digitalWrite'; value: 0 | 1 })
  | (IrActionBase & { op: 'pwmWrite'; value: number })
  | (IrActionBase & { op: 'servoWrite'; angle: number })
  | (IrActionBase & { op: 'tone'; frequency: number; durationMs: number })
  | (IrActionBase & { op: 'stopTone' })
  | (IrActionBase & { op: 'delay'; ms: number })
  | (IrActionBase & {
      op: 'rgbWrite';
      redPin: PinId;
      greenPin: PinId;
      bluePin: PinId;
      red: number;
      green: number;
      blue: number;
    })
  | (IrActionBase & {
      op: 'motorWrite';
      in2Pin: PinId;
      enablePin: PinId;
      direction: 'forward' | 'reverse' | 'brake' | 'stop';
      speed: number;
    });

export interface IrRule {
  /** Id of the condition graph node that produced this rule. */
  id: string;
  /** Must match the `var` of one read. */
  var: string;
  condition: IrCondition;
  then: IrAction[];
  else: IrAction[];
}

export interface IrProgram {
  version: 1;
  title: string;
  loopDelayMs: number;
  reads: IrRead[];
  rules: IrRule[];
}

export const IR_VERSION = 1;
