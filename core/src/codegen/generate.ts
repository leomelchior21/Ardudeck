import { isAnalogPin, pinNumber } from '../components/pins';
import type { PinId } from '../components/pins';
import type { IrAction, IrCondition, IrProgram, IrRead, IrRule } from '../ir/types';
import { toIdentifier, uniqueName } from './cpp-names';

export interface CodeRange {
  /** 1-based, inclusive. */
  start: number;
  end: number;
}

export interface GeneratedSketch {
  code: string;
  /** Node id -> line ranges in the generated sketch, for the code view. */
  lineMap: Record<string, CodeRange[]>;
}

interface Line {
  text: string;
  nodes: string[];
}

class Writer {
  private readonly lines: Line[] = [];

  add(text = '', nodes: readonly string[] = []): void {
    this.lines.push({ text, nodes: [...nodes] });
  }

  render(): GeneratedSketch {
    const code = `${this.lines.map((line) => line.text).join('\n')}\n`;
    const lineMap: Record<string, CodeRange[]> = {};
    this.lines.forEach((line, index) => {
      const lineNumber = index + 1;
      for (const nodeId of line.nodes) {
        const ranges = lineMap[nodeId] ?? [];
        const last = ranges[ranges.length - 1];
        if (last && last.end === lineNumber - 1) last.end = lineNumber;
        else ranges.push({ start: lineNumber, end: lineNumber });
        lineMap[nodeId] = ranges;
      }
    });
    return { code, lineMap };
  }
}

interface ReadMeta {
  valueName: string;
  typeName: string;
  pinName: string;
  helperName: string;
  trigName: string;
  echoName: string;
}

interface ActionMeta {
  /** Generated C++ constant name for every pin the action uses. */
  pinNames: Record<string, string>;
  servoName: string;
}

interface ActionPinRef {
  pin: PinId;
  /** Role inside the action ("red", "in1", ...); empty for classic outputs. */
  role: string;
}

/** Every pin an action drives, with the role it plays. */
function actionPins(action: IrAction): ActionPinRef[] {
  switch (action.op) {
    case 'rgbWrite':
      return [
        { pin: action.redPin, role: 'red' },
        { pin: action.greenPin, role: 'green' },
        { pin: action.bluePin, role: 'blue' },
      ];
    case 'motorWrite': {
      const pins: ActionPinRef[] = [];
      if (action.pin) pins.push({ pin: action.pin, role: 'in1' });
      pins.push({ pin: action.in2Pin, role: 'in2' });
      pins.push({ pin: action.enablePin, role: 'enable' });
      return pins;
    }
    case 'delay':
      return [];
    default:
      return action.pin ? [{ pin: action.pin, role: '' }] : [];
  }
}

function pinName(meta: ActionMeta, pin: PinId | undefined): string {
  return (pin && meta.pinNames[pin]) ?? 'PIN';
}

const OPERATOR: Record<IrCondition['op'], string> = {
  lt: '<',
  gt: '>',
  eq: '==',
  lte: '<=',
  gte: '>=',
  neq: '!=',
};
const OP_WORD: Record<IrCondition['op'], string> = {
  lt: 'less than',
  gt: 'greater than',
  eq: 'equal to',
  lte: 'less than or equal to',
  gte: 'greater than or equal to',
  neq: 'not equal to',
};

function pinLiteral(pin: PinId): string {
  return isAnalogPin(pin) ? pin : String(pinNumber(pin));
}

function actionLine(action: IrAction, meta: ActionMeta): string {
  switch (action.op) {
    case 'digitalWrite':
      return `digitalWrite(${pinName(meta, action.pin)}, ${action.value === 1 ? 'HIGH' : 'LOW'});`;
    case 'pwmWrite':
      return `analogWrite(${pinName(meta, action.pin)}, ${Math.round(action.value)});`;
    case 'servoWrite':
      return `${meta.servoName}.write(${Math.round(action.angle)});`;
    case 'tone':
      return `tone(${pinName(meta, action.pin)}, ${Math.round(action.frequency)}, ${Math.round(action.durationMs)});`;
    case 'stopTone':
      return `noTone(${pinName(meta, action.pin)});`;
    case 'delay':
      return `delay(${Math.round(action.ms)});`;
    case 'rgbWrite': {
      const red = pinName(meta, action.redPin);
      const green = pinName(meta, action.greenPin);
      const blue = pinName(meta, action.bluePin);
      return `analogWrite(${red}, ${Math.round(action.red)}); analogWrite(${green}, ${Math.round(action.green)}); analogWrite(${blue}, ${Math.round(action.blue)});`;
    }
    case 'motorWrite': {
      const in1 = pinName(meta, action.pin);
      const in2 = pinName(meta, action.in2Pin);
      const enable = pinName(meta, action.enablePin);
      const speed = Math.round(action.speed);
      if (action.direction === 'forward') {
        return `digitalWrite(${in1}, HIGH); digitalWrite(${in2}, LOW); analogWrite(${enable}, ${speed});`;
      }
      if (action.direction === 'reverse') {
        return `digitalWrite(${in1}, LOW); digitalWrite(${in2}, HIGH); analogWrite(${enable}, ${speed});`;
      }
      if (action.direction === 'brake') {
        return `digitalWrite(${in1}, HIGH); digitalWrite(${in2}, HIGH); analogWrite(${enable}, 255);`;
      }
      return `digitalWrite(${in1}, LOW); digitalWrite(${in2}, LOW); analogWrite(${enable}, 0);`;
    }
  }
}

/** One header line per action, describing what it drives. */
function describeAction(action: IrAction): string {
  if (action.op === 'rgbWrite') {
    return `${action.name} -> R ${action.redPin}, G ${action.greenPin}, B ${action.bluePin}`;
  }
  if (action.op === 'motorWrite') {
    const direction =
      action.direction === 'forward'
        ? 'FORWARD'
        : action.direction === 'reverse'
          ? 'REVERSE'
          : action.direction.toUpperCase();
    return `${action.name} -> ${direction} IN1 ${action.pin ?? '?'}, IN2 ${action.in2Pin}, EN ${action.enablePin}`;
  }
  if (action.op === 'delay') return `${action.name} -> wait`;
  return `${action.name} -> ${action.pin ?? 'timing'}`;
}

function conditionExpression(read: IrRead, rule: IrRule, valueName: string): string {
  const comparison = `${valueName} ${OPERATOR[rule.condition.op]} ${Math.round(rule.condition.value)}`;
  if (read.kind === 'distance') return `${valueName} >= 0 && ${comparison}`;
  return comparison;
}

function describeBlock(read: IrRead): string {
  if (read.kind === 'distance') {
    return `${read.name} -> TRIG ${read.trigPin ?? '?'}, ECHO ${read.echoPin ?? '?'}`;
  }
  return `${read.name} -> ${read.pin ?? '?'}`;
}

/**
 * Deterministic flow -> Arduino C++ translation. No AI, no external services:
 * the same program always produces byte-identical output, which is what makes
 * "tap a block, see its code" trustworthy.
 */
export function generateArduino(program: IrProgram): GeneratedSketch {
  const writer = new Writer();
  const taken = new Set<string>();

  const readMeta = new Map<string, ReadMeta>();
  const readByVar = new Map<string, IrRead>();
  for (const read of program.reads) {
    readByVar.set(read.var, read);
    const meta: ReadMeta = {
      valueName: uniqueName(toIdentifier(`${read.var} value`), taken),
      typeName: read.kind === 'distance' ? 'long' : 'int',
      pinName: '',
      helperName: '',
      trigName: '',
      echoName: '',
    };
    if (read.kind === 'distance') {
      meta.helperName = uniqueName(toIdentifier(`read ${read.var} cm`), taken);
      meta.trigName = uniqueName(toIdentifier(`${read.var} trig pin`), taken);
      meta.echoName = uniqueName(toIdentifier(`${read.var} echo pin`), taken);
    } else {
      meta.pinName = uniqueName(toIdentifier(`${read.var} pin`), taken);
    }
    readMeta.set(read.id, meta);
  }

  const actionMeta = new Map<string, ActionMeta>();
  const servoObjects: { name: string; pinName: string }[] = [];
  for (const rule of program.rules) {
    for (const action of [...rule.then, ...rule.else]) {
      if (actionMeta.has(action.nodeId)) continue;
      const pinNames: Record<string, string> = {};
      for (const ref of actionPins(action)) {
        pinNames[ref.pin] = uniqueName(
          toIdentifier(ref.role ? `${action.var} ${ref.role}` : `${action.var} pin`),
          taken,
        );
      }
      const meta: ActionMeta = { pinNames, servoName: '' };
      if (action.op === 'servoWrite' && action.pin) {
        meta.servoName = uniqueName(toIdentifier(action.var), taken);
        servoObjects.push({ name: meta.servoName, pinName: pinNames[action.pin] ?? '' });
      }
      actionMeta.set(action.nodeId, meta);
    }
  }

  const actionBlocks: string[] = [];
  const seenActionNodes = new Set<string>();
  for (const rule of program.rules) {
    for (const action of [...rule.then, ...rule.else]) {
      if (seenActionNodes.has(action.nodeId)) continue;
      seenActionNodes.add(action.nodeId);
      actionBlocks.push(describeAction(action));
    }
  }

  writer.add('/*');
  writer.add(`  ${program.title}`);
  writer.add('  Generated by ArduDeck from a visual flow.');
  for (const read of program.reads) writer.add(`  - ${describeBlock(read)}`);
  for (const block of actionBlocks) writer.add(`  - ${block}`);
  writer.add('*/');
  writer.add();

  if (servoObjects.length > 0) {
    writer.add('#include <Servo.h>');
    writer.add();
  }

  writer.add('// --- Pins ---');
  for (const read of program.reads) {
    const meta = readMeta.get(read.id);
    if (!meta) continue;
    if (read.kind === 'distance') {
      if (read.trigPin) writer.add(`const int ${meta.trigName} = ${pinLiteral(read.trigPin)};`, [read.id]);
      if (read.echoPin) writer.add(`const int ${meta.echoName} = ${pinLiteral(read.echoPin)};`, [read.id]);
    } else if (read.pin) {
      writer.add(`const int ${meta.pinName} = ${pinLiteral(read.pin)};`, [read.id]);
    }
  }
  const declaredActionNodes = new Set<string>();
  for (const rule of program.rules) {
    for (const action of [...rule.then, ...rule.else]) {
      if (declaredActionNodes.has(action.nodeId)) continue;
      declaredActionNodes.add(action.nodeId);
      const meta = actionMeta.get(action.nodeId);
      if (!meta) continue;
      for (const ref of actionPins(action)) {
        writer.add(`const int ${pinName(meta, ref.pin)} = ${pinLiteral(ref.pin)};`, [action.nodeId]);
      }
    }
  }
  writer.add();

  for (const read of program.reads) {
    const meta = readMeta.get(read.id);
    if (!meta || read.kind !== 'distance') continue;
    writer.add(`// ${read.name} on TRIG ${read.trigPin ?? '?'} / ECHO ${read.echoPin ?? '?'}`, [read.id]);
    writer.add(`long ${meta.helperName}() {`, [read.id]);
    writer.add(`  digitalWrite(${meta.trigName}, LOW);`, [read.id]);
    writer.add('  delayMicroseconds(2);', [read.id]);
    writer.add(`  digitalWrite(${meta.trigName}, HIGH);`, [read.id]);
    writer.add('  delayMicroseconds(10);', [read.id]);
    writer.add(`  digitalWrite(${meta.trigName}, LOW);`, [read.id]);
    writer.add(`  long duration = pulseIn(${meta.echoName}, HIGH, 30000);`, [read.id]);
    writer.add('  if (duration == 0) {', [read.id]);
    writer.add('    return -1;', [read.id]);
    writer.add('  }', [read.id]);
    writer.add('  return duration / 58;', [read.id]);
    writer.add('}', [read.id]);
    writer.add();
  }

  if (servoObjects.length > 0) {
    writer.add('// --- Servos ---');
    for (const servo of servoObjects) {
      writer.add(`Servo ${servo.name};`);
    }
    writer.add();
  }

  writer.add('void setup() {');
  for (const read of program.reads) {
    const meta = readMeta.get(read.id);
    if (!meta) continue;
    if (read.kind === 'digital' && read.pin) {
      const mode = read.pullup ? 'INPUT_PULLUP' : 'INPUT';
      writer.add(`  pinMode(${meta.pinName}, ${mode});`, [read.id]);
    }
    if (read.kind === 'distance') {
      writer.add(`  pinMode(${meta.trigName}, OUTPUT);`, [read.id]);
      writer.add(`  pinMode(${meta.echoName}, INPUT);`, [read.id]);
    }
  }
  const emittedOutputPins = new Set<string>();
  for (const rule of program.rules) {
    for (const action of [...rule.then, ...rule.else]) {
      const meta = actionMeta.get(action.nodeId);
      if (!meta) continue;
      for (const ref of actionPins(action)) {
        const name = pinName(meta, ref.pin);
        if (emittedOutputPins.has(name)) continue;
        emittedOutputPins.add(name);
        writer.add(`  pinMode(${name}, OUTPUT);`, [action.nodeId]);
      }
    }
  }
  for (const servo of servoObjects) {
    writer.add(`  ${servo.name}.attach(${servo.pinName});`);
  }
  writer.add('}');
  writer.add();

  writer.add('void loop() {');
  for (const read of program.reads) {
    const meta = readMeta.get(read.id);
    if (!meta) continue;
    if (read.kind === 'distance') {
      writer.add(`  ${meta.typeName} ${meta.valueName} = ${meta.helperName}();`, [read.id]);
    } else if (read.kind === 'digital') {
      writer.add(`  ${meta.typeName} ${meta.valueName} = digitalRead(${meta.pinName});`, [read.id]);
    } else {
      writer.add(`  ${meta.typeName} ${meta.valueName} = analogRead(${meta.pinName});`, [read.id]);
    }
  }

  for (const rule of program.rules) {
    const read = readByVar.get(rule.var);
    const meta = read ? readMeta.get(read.id) : undefined;
    if (!read || !meta) continue;

    writer.add();
    const unit = read.kind === 'distance' ? ' cm' : '';
    writer.add(
      `  // ${read.name} is ${OP_WORD[rule.condition.op]} ${Math.round(rule.condition.value)}${unit}`,
      [rule.id],
    );
    const expression = conditionExpression(read, rule, meta.valueName);

    if (rule.then.length === 0 && rule.else.length === 0) continue;

    if (rule.else.length === 0) {
      writer.add(`  if (${expression}) {`, [rule.id]);
      for (const action of rule.then) {
        const actionInfo = actionMeta.get(action.nodeId);
        if (actionInfo) writer.add(`    ${actionLine(action, actionInfo)}`, [action.nodeId]);
      }
      writer.add('  }', [rule.id]);
      continue;
    }

    writer.add(`  if (${expression}) {`, [rule.id]);
    for (const action of rule.then) {
      const actionInfo = actionMeta.get(action.nodeId);
      if (actionInfo) writer.add(`    ${actionLine(action, actionInfo)}`, [action.nodeId]);
    }
    writer.add('  } else {', [rule.id]);
    for (const action of rule.else) {
      const actionInfo = actionMeta.get(action.nodeId);
      if (actionInfo) writer.add(`    ${actionLine(action, actionInfo)}`, [action.nodeId]);
    }
    writer.add('  }', [rule.id]);
  }

  writer.add();
  writer.add(`  delay(${program.loopDelayMs});`);
  writer.add('}');

  return writer.render();
}
