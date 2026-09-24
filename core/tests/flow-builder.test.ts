import { describe, expect, it } from 'vitest';
import type { IrAction } from '../src';
import { buildIr, compileFlow, getComponent } from '../src';
import { addEdge, addNode, createFlow, createNode } from '../src';
import { buildFlow } from './helpers/flows';

function digitalValues(actions: IrAction[]): (0 | 1 | null)[] {
  return actions.map((action) => (action.op === 'digitalWrite' ? action.value : null));
}

const OPERATOR_CASES = [
  { componentId: 'lessThan', symbol: '<' },
  { componentId: 'greaterThan', symbol: '>' },
  { componentId: 'equalsTo', symbol: '==' },
  { componentId: 'lessThanOrEqual', symbol: '<=' },
  { componentId: 'greaterThanOrEqual', symbol: '>=' },
  { componentId: 'notEquals', symbol: '!=' },
] as const;

describe('flow builder: condition operators', () => {
  it.each(OPERATOR_CASES)('generates $symbol for $componentId', ({ componentId, symbol }) => {
    const flow = buildFlow(
      [
        { id: 'sensor_light', componentId: 'ldr', pins: { signal: 'A0' }, y: 0 },
        { id: 'cond', componentId, fields: { value: 300 }, y: 140 },
        { id: 'act_led', componentId: 'led', pins: { signal: 'D9' }, y: 280 },
      ],
      [
        ['sensor_light', 'cond'],
        ['cond', 'act_led'],
      ],
    );
    const result = compileFlow(flow);
    expect(result.ok).toBe(true);
    expect(result.sketch?.code).toContain(`lightValue ${symbol} 300`);
  });
});

describe('flow builder: branches', () => {
  it('defaults an unlabelled edge to the true branch', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' }, y: 0 },
        { id: 'c', componentId: 'lessThan', fields: { value: 300 }, y: 140 },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' }, fields: { whenTrue: 'on' }, y: 280 },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    const built = buildIr(flow);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(digitalValues(built.program.rules[0]?.then ?? [])).toEqual([1]);
    expect(digitalValues(built.program.rules[0]?.else ?? [])).toEqual([0]);
  });

  it('activates an actuator placed on the false branch when the rule is false', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' }, y: 0 },
        { id: 'c', componentId: 'lessThan', fields: { value: 300 }, y: 140 },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' }, fields: { whenTrue: 'on' }, y: 280 },
      ],
      [['s', 'c']],
    );
    const withBranch = addEdge(flow, 'c', 'a', 'edge_false', 'false');
    const built = buildIr(withBranch);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(digitalValues(built.program.rules[0]?.else ?? [])).toEqual([1]);
    expect(digitalValues(built.program.rules[0]?.then ?? [])).toEqual([0]);
  });
});

describe('flow builder: control and actuator actions', () => {
  it('emits a delay action for the Delay block', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' }, y: 0 },
        { id: 'c', componentId: 'lessThan', fields: { value: 300 }, y: 140 },
        { id: 'd', componentId: 'delay', fields: { ms: 750 }, y: 280 },
      ],
      [
        ['s', 'c'],
        ['c', 'd'],
      ],
    );
    const result = compileFlow(flow);
    expect(result.ok).toBe(true);
    const code = result.sketch?.code ?? '';
    expect(code).toContain('delay(750);');
    expect(code.match(/delay\(750\)/g) ?? []).toHaveLength(1);
    expect(code).not.toContain('LOW');
  });

  it('drives a relay like a digital output and names the load', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'soil', pins: { signal: 'A1' }, y: 0 },
        { id: 'c', componentId: 'lessThan', fields: { value: 400 }, y: 140 },
        {
          id: 'r',
          componentId: 'relay',
          pins: { signal: 'D7' },
          fields: { load: 'pump', whenTrue: 'on' },
          y: 280,
        },
      ],
      [
        ['s', 'c'],
        ['c', 'r'],
      ],
    );
    const result = compileFlow(flow);
    expect(result.ok).toBe(true);
    const code = result.sketch?.code ?? '';
    expect(code).toContain('Relay (pump) -> D7');
    expect(code).toContain('digitalWrite(relayPin, HIGH);');
  });

  it('writes a speed angle for the continuous servo', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'touch', pins: { signal: 'D4' }, y: 0 },
        { id: 'c', componentId: 'equalsTo', fields: { value: 1 }, y: 140 },
        {
          id: 'm',
          componentId: 'servo360',
          pins: { signal: 'D9' },
          fields: { speedTrue: 130, restSpeed: 90 },
          y: 280,
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
    expect(code).toContain('servo.write(130);');
    expect(code).toContain('servo.write(90);');
  });

  it('runs actions in the order they are placed on the canvas', () => {
    const delayFirst = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' }, y: 0 },
        { id: 'c', componentId: 'lessThan', fields: { value: 300 }, y: 140 },
        { id: 'd', componentId: 'delay', fields: { ms: 500 }, y: 260 },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' }, y: 380 },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
        ['c', 'd'],
      ],
    );
    const first = compileFlow(delayFirst).sketch?.code ?? '';
    expect(first.indexOf('delay(500)')).toBeLessThan(first.indexOf('digitalWrite(ledPin'));

    const delayLast = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' }, y: 0 },
        { id: 'c', componentId: 'lessThan', fields: { value: 300 }, y: 140 },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' }, y: 260 },
        { id: 'd', componentId: 'delay', fields: { ms: 500 }, y: 380 },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
        ['c', 'd'],
      ],
    );
    const last = compileFlow(delayLast).sketch?.code ?? '';
    expect(last.indexOf('digitalWrite(ledPin')).toBeLessThan(last.indexOf('delay(500)'));
  });

  it('reads the water level sensor as an analog input', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'water', pins: { signal: 'A2' }, y: 0 },
        { id: 'c', componentId: 'greaterThan', fields: { value: 700 }, y: 140 },
        { id: 'a', componentId: 'buzzer', pins: { signal: 'D6' }, y: 280 },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    const result = compileFlow(flow);
    expect(result.ok).toBe(true);
    const code = result.sketch?.code ?? '';
    expect(code).toContain('const int waterLevelPin = A2;');
    expect(code).toContain('int waterLevelValue = analogRead(waterLevelPin);');
  });
});

describe('flow builder: new sensors', () => {
  it('reads PIR motion as a plain digital input', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'pir', pins: { signal: 'D4' }, y: 0 },
        { id: 'c', componentId: 'equalsTo', fields: { value: 1 }, y: 140 },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' }, y: 280 },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    const built = buildIr(flow);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const read = built.program.reads[0];
    expect(read?.kind).toBe('digital');
    expect(read?.pullup).toBe(false);
  });

  it('reads a switch with the built-in pull-up by default', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'switch', pins: { signal: 'D5' }, y: 0 },
        { id: 'c', componentId: 'equalsTo', fields: { value: 1 }, y: 140 },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' }, y: 280 },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    const built = buildIr(flow);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.program.reads[0]?.pullup).toBe(true);
  });

  it('exposes wiring badges for physical components only', () => {
    const light = getComponent('ldr');
    expect(light?.wiring?.map((pin) => pin.label)).toEqual(['5V', 'GND']);
    expect(getComponent('lessThan')?.wiring).toBeUndefined();
  });

  it('runs stacked control blocks in order and rests on the opposite branch', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' }, y: 0 },
        { id: 'c', componentId: 'lessThan', fields: { value: 300 }, y: 140 },
        {
          id: 'a',
          componentId: 'led',
          pins: { signal: 'D9' },
          y: 280,
          blocks: [
            { id: 'b1', kind: 'high' },
            { id: 'b2', kind: 'delay', values: { ms: 250 } },
            { id: 'b3', kind: 'low' },
          ],
        },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    const built = buildIr(flow);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const rule = built.program.rules[0];
    expect(rule?.then.map((action) => action.op)).toEqual([
      'digitalWrite',
      'delay',
      'digitalWrite',
    ]);
    expect(digitalValues(rule?.then ?? [])).toEqual([1, null, 0]);
    expect(digitalValues(rule?.else ?? [])).toEqual([0]);
  });

  it('keeps delay blocks inside the sequence', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' }, y: 0 },
        { id: 'c', componentId: 'lessThan', fields: { value: 300 }, y: 140 },
        {
          id: 'a',
          componentId: 'led',
          pins: { signal: 'D9' },
          y: 280,
          blocks: [
            { id: 'b1', kind: 'high' },
            { id: 'b2', kind: 'delay', values: { ms: 400 } },
          ],
        },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    const built = buildIr(flow);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const delay = built.program.rules[0]?.then.find((action) => action.op === 'delay');
    expect(delay && delay.op === 'delay' ? delay.ms : null).toBe(400);
  });

  it('drives the RGB LED with all three channels and rests to black', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' }, y: 0 },
        { id: 'c', componentId: 'lessThan', fields: { value: 300 }, y: 140 },
        {
          id: 'a',
          componentId: 'rgb',
          pins: { red: 'D9', green: 'D10', blue: 'D11' },
          y: 280,
          blocks: [{ id: 'b1', kind: 'color', values: { red: 255, green: 0, blue: 128 } }],
        },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    const built = buildIr(flow);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    expect(built.program.rules[0]?.then[0]).toMatchObject({
      op: 'rgbWrite',
      redPin: 'D9',
      greenPin: 'D10',
      bluePin: 'D11',
      red: 255,
      green: 0,
      blue: 128,
    });
    expect(built.program.rules[0]?.else[0]).toMatchObject({
      op: 'rgbWrite',
      red: 0,
      green: 0,
      blue: 0,
    });
  });

  it('drives the L298N with direction pins and a PWM enable pin', () => {
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
            { id: 'b2', kind: 'delay', values: { ms: 500 } },
            { id: 'b3', kind: 'stop' },
          ],
        },
      ],
      [
        ['s', 'c'],
        ['c', 'm'],
      ],
    );
    const built = buildIr(flow);
    expect(built.ok).toBe(true);
    if (!built.ok) return;
    const rule = built.program.rules[0];
    expect(rule?.then.map((action) => (action.op === 'motorWrite' ? action.direction : action.op))).toEqual([
      'forward',
      'delay',
      'stop',
    ]);
    expect(rule?.then[0]).toMatchObject({
      op: 'motorWrite',
      in2Pin: 'D7',
      enablePin: 'D5',
      speed: 200,
    });
    expect(rule?.else[0]).toMatchObject({ op: 'motorWrite', direction: 'stop', speed: 0 });
  });

  it('starts every new actuator card with a sensible control block', () => {
    expect(createNode('motor', { x: 0, y: 0 }).config.blocks?.[0]?.kind).toBe('stop');
    expect(createNode('rgb', { x: 0, y: 0 }).config.blocks?.[0]?.kind).toBe('color');
    expect(createNode('led', { x: 0, y: 0 }).config.blocks?.[0]?.kind).toBe('high');
    expect(createNode('servo', { x: 0, y: 0 }).config.blocks?.[0]?.kind).toBe('angle');
    expect(createNode('servo', { x: 0, y: 0 }).config.blocks?.[0]?.values?.angle).toBe(90);
    expect(createNode('delay', { x: 0, y: 0 }).config.blocks).toBeUndefined();
  });

  it('saves and restores control blocks through serialization', async () => {
    const { parseFlow, serializeFlow } = await import('../src');
    const flow = buildFlow(
      [
        {
          id: 'm',
          componentId: 'motor',
          pins: { in1: 'D4', in2: 'D7', enable: 'D5' },
          blocks: [
            { id: 'b1', kind: 'forward', values: { speed: 180 } },
            { id: 'b2', kind: 'delay', values: { ms: 300 } },
          ],
        },
      ],
      [],
    );
    const parsed = parseFlow(serializeFlow(flow));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const blocks = parsed.flow.nodes[0]?.config.blocks;
    expect(blocks?.map((block) => block.kind)).toEqual(['forward', 'delay']);
    expect(blocks?.[0]?.values?.speed).toBe(180);
  });

  it('keeps a deliberately emptied block list empty', async () => {
    const { parseFlow, serializeFlow } = await import('../src');
    const flow = buildFlow(
      [
        {
          id: 'a',
          componentId: 'rgb',
          pins: { red: 'D9', green: 'D10', blue: 'D11' },
          blocks: [],
        },
      ],
      [],
    );
    const parsed = parseFlow(serializeFlow(flow));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.flow.nodes[0]?.config.blocks).toBeUndefined();
  });

  it('saves and restores a false branch through serialization', async () => {
    const { parseFlow, serializeFlow } = await import('../src');
    let flow = createFlow('Branch', 'flow_branch');
    flow = addNode(flow, createNode('ldr', { x: 0, y: 0 }, 's'));
    flow = addNode(flow, createNode('lessThan', { x: 0, y: 140 }, 'c'));
    flow = addNode(flow, createNode('led', { x: 0, y: 280 }, 'a'));
    flow = addEdge(flow, 's', 'c');
    flow = addEdge(flow, 'c', 'a', undefined, 'false');
    const parsed = parseFlow(serializeFlow(flow));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.flow.edges.find((edge) => edge.target === 'a')?.branch).toBe('false');
  });
});
