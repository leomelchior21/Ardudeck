import { describe, expect, it } from 'vitest';
import {
  addEdge,
  addNode,
  buildIr,
  compileFlow,
  createFlow,
  createNode,
  generateArduino,
} from '../src';
import { buildFlow, lightLedFlow } from './helpers/flows';
import { expectGolden } from './helpers/golden';

describe('pipeline: flow -> IR -> Arduino C++', () => {
  it('compiles the canonical light -> LED flow', () => {
    const result = compileFlow(lightLedFlow());
    expect(result.ok).toBe(true);
    expect(result.program).toBeDefined();
    expect(result.sketch).toBeDefined();
  });

  it('produces the golden IR and sketch', () => {
    const result = compileFlow(lightLedFlow());
    if (!result.program || !result.sketch) throw new Error('compile failed');
    expectGolden('light-led.ir.json', `${JSON.stringify(result.program, null, 2)}\n`);
    expectGolden('light-led.ino', result.sketch.code);
  });

  it('maps every block to lines in the sketch', () => {
    const result = compileFlow(lightLedFlow());
    const lineMap = result.sketch?.lineMap ?? {};
    expect(Object.keys(lineMap).sort()).toEqual(['act_led', 'cond_less', 'sensor_light']);
    const lines = (result.sketch?.code ?? '').split('\n');
    const readLines = (lineMap['sensor_light'] ?? [])
      .map((range) => lines.slice(range.start - 1, range.end).join('\n'))
      .join('\n');
    expect(readLines).toContain('analogRead(lightPin)');
  });

  it('is deterministic', () => {
    const first = compileFlow(lightLedFlow()).sketch?.code;
    const second = compileFlow(lightLedFlow()).sketch?.code;
    expect(first).toBe(second);
  });

  it('does not emit a sketch for an invalid flow', () => {
    const result = compileFlow(buildFlow([], []));
    expect(result.ok).toBe(false);
    expect(result.sketch).toBeUndefined();
    expect(result.validation.summary).toBe('Add a component to start.');
  });

  it('compiles an actuator-only flow (standalone LED blink)', () => {
    const flow = buildFlow(
      [
        {
          id: 'act_led',
          componentId: 'led',
          pins: { signal: 'D9' },
          blocks: [
            { id: 'b1', kind: 'high' },
            { id: 'b2', kind: 'delay', values: { ms: 500 } },
            { id: 'b3', kind: 'low' },
            { id: 'b4', kind: 'delay', values: { ms: 500 } },
          ],
        },
      ],
      [],
    );
    const result = compileFlow(flow);
    expect(result.ok).toBe(true);
    expect(result.program?.reads).toHaveLength(0);
    expect(result.program?.rules[0]?.condition.op).toBe('always');
    const code = result.sketch?.code ?? '';
    expect(code).toContain('// Always');
    expect(code).toContain('digitalWrite(ledPin, HIGH);');
    expect(code).toContain('digitalWrite(ledPin, LOW);');
    expect(code).toContain('delay(500);');
  });

  it('generates a guarded distance reading', () => {
    const flow = buildFlow(
      [
        {
          id: 'sensor_distance',
          componentId: 'ultrasonic',
          pins: { trig: 'D7', echo: 'D8' },
          y: 0,
        },
        { id: 'cond_close', componentId: 'lessThan', fields: { value: 30 }, y: 140 },
        { id: 'act_buzzer', componentId: 'buzzer', pins: { signal: 'D6' }, y: 280 },
      ],
      [
        ['sensor_distance', 'cond_close'],
        ['cond_close', 'act_buzzer'],
      ],
    );
    const result = compileFlow(flow);
    expect(result.ok).toBe(true);
    const code = result.sketch?.code ?? '';
    expect(code).toContain('long readDistanceCm()');
    expect(code).toContain('pulseIn(distanceEchoPin, HIGH, 30000)');
    expect(code).toContain('long distanceValue = readDistanceCm();');
    expect(code).toContain('distanceValue >= 0 && distanceValue < 30');
    expect(code).toContain('tone(buzzerPin, 440, 200);');
    expect(code).toContain('noTone(buzzerPin);');
    expect(result.program?.loopDelayMs).toBe(60);
  });

  it('includes the Servo library only when needed', () => {
    const flow = buildFlow(
      [
        { id: 'sensor_knob', componentId: 'potentiometer', pins: { signal: 'A1' }, y: 0 },
        { id: 'cond_big', componentId: 'greaterThan', fields: { value: 700 }, y: 140 },
        {
          id: 'act_servo',
          componentId: 'servo',
          pins: { signal: 'D5' },
          fields: { angle: 90, restAngle: 0 },
          y: 280,
        },
      ],
      [
        ['sensor_knob', 'cond_big'],
        ['cond_big', 'act_servo'],
      ],
    );
    const result = compileFlow(flow);
    expect(result.ok).toBe(true);
    const code = result.sketch?.code ?? '';
    expect(code).toContain('#include <Servo.h>');
    expect(code).toContain('Servo servo;');
    expect(code).toContain('servo.attach(servoPin);');
    expect(code).toContain('servo.write(90);');
    expect(code).toContain('servo.write(0);');

    const withoutServo = compileFlow(lightLedFlow()).sketch?.code ?? '';
    expect(withoutServo).not.toContain('#include <Servo.h>');
  });

  it('uses the pull-up for a button wired to GND', () => {
    const flow = buildFlow(
      [
        {
          id: 'sensor_button',
          componentId: 'button',
          pins: { signal: 'D2' },
          fields: { wiring: 'gnd' },
          y: 0,
        },
        { id: 'cond_pressed', componentId: 'equalsTo', fields: { value: 1 }, y: 140 },
        { id: 'act_led', componentId: 'led', pins: { signal: 'D9' }, y: 280 },
      ],
      [
        ['sensor_button', 'cond_pressed'],
        ['cond_pressed', 'act_led'],
      ],
    );
    const code = compileFlow(flow).sketch?.code ?? '';
    expect(code).toContain('pinMode(buttonPin, INPUT_PULLUP);');
    expect(code).toContain('int buttonValue = digitalRead(buttonPin);');
    expect(code).toContain('if (buttonValue == 1) {');
  });

  it('inverts the LED action when "when true" is off', () => {
    const flow = lightLedFlow();
    const inverted = {
      ...flow,
      nodes: flow.nodes.map((node) =>
        node.id === 'act_led'
          ? { ...node, config: { ...node.config, fields: { whenTrue: 'off' } } }
          : node,
      ),
    };
    const code = compileFlow(inverted).sketch?.code ?? '';
    expect(code).toContain('digitalWrite(ledPin, LOW);');
    expect(code).toContain('digitalWrite(ledPin, HIGH);');
  });

  it('generates PWM writes for every RGB channel', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' }, y: 0 },
        { id: 'c', componentId: 'lessThan', fields: { value: 300 }, y: 140 },
        {
          id: 'a',
          componentId: 'rgb',
          pins: { red: 'D9', green: 'D10', blue: 'D11' },
          y: 280,
          blocks: [
            { id: 'b1', kind: 'color', values: { red: 255, green: 0, blue: 128 } },
            { id: 'b2', kind: 'delay', values: { ms: 300 } },
          ],
        },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    const result = compileFlow(flow);
    expect(result.ok).toBe(true);
    const code = result.sketch?.code ?? '';
    expect(code).toContain('const int rgbLedRed = 9;');
    expect(code).toContain('const int rgbLedGreen = 10;');
    expect(code).toContain('const int rgbLedBlue = 11;');
    expect(code).toContain(
      'analogWrite(rgbLedRed, 255); analogWrite(rgbLedGreen, 0); analogWrite(rgbLedBlue, 128);',
    );
    expect(code).toContain(
      'analogWrite(rgbLedRed, 0); analogWrite(rgbLedGreen, 0); analogWrite(rgbLedBlue, 0);',
    );
    expect(code).toContain('delay(300);');
  });

  it('generates direction and enable writes for the L298N', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'touch', pins: { signal: 'D2' }, y: 0 },
        { id: 'c', componentId: 'equalsTo', fields: { value: 1 }, y: 140 },
        {
          id: 'm',
          componentId: 'motor',
          pins: { in1: 'D4', in2: 'D7', enable: 'D5' },
          y: 280,
          blocks: [
            { id: 'b1', kind: 'forward', values: { speed: 200 } },
            { id: 'b2', kind: 'delay', values: { ms: 1000 } },
            { id: 'b3', kind: 'reverse', values: { speed: 120 } },
            { id: 'b4', kind: 'stop' },
          ],
        },
      ],
      [
        ['s', 'c'],
        ['c', 'm'],
      ],
    );
    const result = compileFlow(flow);
    expect(result.ok).toBe(true);
    const code = result.sketch?.code ?? '';
    expect(code).toContain('const int motorIn1 = 4;');
    expect(code).toContain('const int motorIn2 = 7;');
    expect(code).toContain('const int motorEnable = 5;');
    expect(code).toContain('digitalWrite(motorIn1, HIGH); digitalWrite(motorIn2, LOW); analogWrite(motorEnable, 200);');
    expect(code).toContain('digitalWrite(motorIn1, LOW); digitalWrite(motorIn2, HIGH); analogWrite(motorEnable, 120);');
    expect(code).toContain('Motor Driver L298N -> FORWARD IN1 D4, IN2 D7, EN D5');
  });

  it('turns a new motor card into a stopped motor when deployed', () => {
    const button = createNode('button', { x: 0, y: 0 }, 's');
    button.config.pins = { signal: 'D2' };
    const sensor = addNode(createFlow('Motor', 'flow_motor'), button);
    const condition = addNode(sensor, createNode('equalsTo', { x: 0, y: 140 }, 'c'));
    const motor = createNode('motor', { x: 0, y: 280 }, 'm');
    motor.config.pins = { in1: 'D4', in2: 'D7', enable: 'D5' };
    let flow = addNode(condition, motor);
    flow = addEdge(flow, 's', 'c');
    flow = addEdge(flow, 'c', 'm');

    const result = compileFlow(flow);
    expect(result.ok).toBe(true);
    const code = result.sketch?.code ?? '';
    expect(code).toContain(
      'digitalWrite(motorIn1, LOW); digitalWrite(motorIn2, LOW); analogWrite(motorEnable, 0);',
    );
  });

  it('reports a readable error when a sensor has no pin', () => {
    const ir = buildIr(buildFlow([{ id: 's', componentId: 'ldr' }], []));
    expect(ir.ok).toBe(false);
    if (!ir.ok) expect(ir.error).toBe('Choose a pin for Light Sensor.');
  });

  it('keeps variable names unique for repeated components', () => {
    const flow = buildFlow(
      [
        { id: 's1', componentId: 'ldr', pins: { signal: 'A0' }, y: 0 },
        { id: 's2', componentId: 'ldr', pins: { signal: 'A1' }, y: 100 },
        { id: 'c1', componentId: 'lessThan', fields: { value: 200 }, y: 200 },
        { id: 'c2', componentId: 'greaterThan', fields: { value: 800 }, y: 300 },
        { id: 'a1', componentId: 'led', pins: { signal: 'D9' }, y: 400 },
        { id: 'a2', componentId: 'led', pins: { signal: 'D10' }, y: 500 },
      ],
      [
        ['s1', 'c1'],
        ['s2', 'c2'],
        ['c1', 'a1'],
        ['c2', 'a2'],
      ],
    );
    const result = compileFlow(flow);
    expect(result.ok).toBe(true);
    const program = result.program;
    expect(program?.reads.map((read) => read.var)).toEqual(['light', 'light2']);
    const code = result.sketch?.code ?? '';
    expect(code).toContain('const int lightPin = A0;');
    expect(code).toContain('const int light2Pin = A1;');
    expect(code).toContain('const int ledPin = 9;');
    expect(code).toContain('const int led2Pin = 10;');
  });

  it('generates code straight from a program', () => {
    const ir = buildIr(lightLedFlow());
    if (!ir.ok) throw new Error('build failed');
    const sketch = generateArduino(ir.program);
    expect(sketch.code).toContain('void setup() {');
    expect(sketch.code).toContain('void loop() {');
  });
});
