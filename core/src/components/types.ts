import type { PinKind } from './pins';

export type ComponentCategory = 'sensor' | 'condition' | 'actuator';

export type NodeComponentId =
  | 'ldr'
  | 'potentiometer'
  | 'button'
  | 'ultrasonic'
  | 'pir'
  | 'switch'
  | 'temperature'
  | 'humidity'
  | 'rain'
  | 'water'
  | 'touch'
  | 'infrared'
  | 'sound'
  | 'soil'
  | 'led'
  | 'buzzer'
  | 'servo'
  | 'servo360'
  | 'relay'
  | 'rgb'
  | 'motor'
  | 'delay'
  | 'lessThan'
  | 'greaterThan'
  | 'equalsTo'
  | 'lessThanOrEqual'
  | 'greaterThanOrEqual'
  | 'notEquals';

export type IconId =
  | 'sun'
  | 'knob'
  | 'button'
  | 'wave'
  | 'led'
  | 'rgb'
  | 'buzzer'
  | 'servo'
  | 'less'
  | 'greater'
  | 'equal'
  | 'motion'
  | 'switch'
  | 'thermometer'
  | 'motor'
  | 'droplet'
  | 'rain'
  | 'water'
  | 'hand'
  | 'infrared'
  | 'sound'
  | 'soil'
  | 'relay'
  | 'timer';

export interface PinSpec {
  /** Stable id used in node config, e.g. "signal", "trig", "echo". */
  id: string;
  label: string;
  kinds: PinKind[];
  help?: string;
}

/**
 * A wiring connection that every student must make but that is not a
 * configurable pin: power and ground are shared rails on the board. These are
 * shown on the component card so the student sees the complete wiring, but
 * they never take part in pin-conflict validation.
 */
export interface WiringPin {
  label: string;
  role: 'power' | 'ground';
}

export interface NumberField {
  type: 'number';
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  defaultValue: number;
}

export interface SelectChoice {
  value: string;
  label: string;
  hint?: string;
}

export interface SelectField {
  type: 'select';
  id: string;
  label: string;
  options: SelectChoice[];
  defaultValue: string;
}

export interface ToggleField {
  type: 'toggle';
  id: string;
  label: string;
  defaultValue: boolean;
  help?: string;
}

export type ConfigField = NumberField | SelectField | ToggleField;

/** One editable number inside a control block (angle, speed, wait, ...). */
export interface BlockFieldSpec {
  id: string;
  min: number;
  max: number;
  step: number;
  unit?: string;
  defaultValue: number;
}

/**
 * A command a student can stack on an actuator card, like HIGH, LOW, ANGLE or
 * DELAY. Blocks run in the order they are placed, so a card can describe a
 * small sequence instead of a single command.
 */
export interface BlockSpec {
  kind: string;
  /** Full label shown in the "add control" menu. */
  label: string;
  /** Short text shown on the chip, e.g. "HIGH". */
  text: string;
  numbers?: BlockFieldSpec[];
  /** Renders one colour picker that edits the red/green/blue numbers. */
  color?: boolean;
}

export interface ReadingSpec {
  /** How the value is acquired from the board. */
  kind: 'analog' | 'digital' | 'distance';
  unit: string;
  min: number;
  max: number;
  decimals: number;
  lowLabel?: string;
  highLabel?: string;
}

export interface ComponentDef {
  id: NodeComponentId;
  /** Student-facing name, e.g. "Light Sensor". */
  name: string;
  /** Short name for compact node cards, e.g. "LIGHT". */
  shortName: string;
  category: ComponentCategory;
  icon: IconId;
  /** One-line explanation shown in the tray and config sheet. */
  summary: string;
  /** Short plain-language description shown under the card title. */
  subtitle?: string;
  /** Base identifier used for generated variable names. */
  varBase: string;
  pins: PinSpec[];
  /** Power/ground rails shown on the card as fixed wiring badges. */
  wiring?: WiringPin[];
  fields: ConfigField[];
  /**
   * Control blocks this actuator understands. When present, the card shows a
   * block area and any blocks the student adds replace the old single command.
   */
  blocks?: BlockSpec[];
  /** Kind used for the first block of a brand new card. */
  defaultBlock?: string;
  /** The card is only useful once the student adds at least one block. */
  requiresBlocks?: boolean;
  reading?: ReadingSpec;
  /** Wiring / power safety note shown in the config sheet. */
  safety?: string;
  /** False when the component can be simulated and deployed but not driven live yet. */
  live: boolean;
  deployable: boolean;
}
