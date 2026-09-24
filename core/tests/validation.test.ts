import { describe, expect, it } from 'vitest';
import { validateFlow } from '../src';
import type { Flow } from '../src';
import { buildFlow, lightLedFlow } from './helpers/flows';

function codes(flow: Flow): string[] {
  return validateFlow(flow).issues.map((issue) => issue.code);
}

describe('validateFlow', () => {
  it('accepts the canonical light -> condition -> LED flow', () => {
    const result = validateFlow(lightLedFlow());
    expect(result.ok).toBe(true);
    expect(result.summary).toBe('Ready');
    expect(result.errors).toHaveLength(0);
  });

  it('asks for a component when the canvas is empty', () => {
    const flow = buildFlow([], []);
    const result = validateFlow(flow);
    expect(result.ok).toBe(false);
    expect(result.summary).toBe('Add a component to start.');
  });

  it('asks for a pin', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr' },
        { id: 'c', componentId: 'lessThan' },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' } },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    const result = validateFlow(flow);
    expect(codes(flow)).toContain('missing-pin');
    expect(result.summary).toBe('Choose a pin for Light Sensor.');
  });

  it('rejects two blocks sharing a pin', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'button', pins: { signal: 'D9' } },
        { id: 'c', componentId: 'equalsTo' },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' } },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    const result = validateFlow(flow);
    expect(result.summary).toBe('Button and LED are using the same pin (D9).');
    expect(result.errors[0]?.relatedNodeId).toBe('a');
  });

  it('rejects the same pin twice inside one block', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ultrasonic', pins: { trig: 'D7', echo: 'D7' } },
        { id: 'c', componentId: 'lessThan' },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' } },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    expect(validateFlow(flow).summary).toBe('TRIG and ECHO cannot share pin D7.');
  });

  it('rejects a pin that cannot do the job', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'D9' } },
        { id: 'c', componentId: 'lessThan' },
        { id: 'a', componentId: 'led', pins: { signal: 'D10' } },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    expect(codes(flow)).toContain('bad-pin');
  });

  it('asks the student to connect a loose block', () => {
    const flow = buildFlow([{ id: 's', componentId: 'ldr', pins: { signal: 'A0' } }], []);
    expect(validateFlow(flow).summary).toBe('Connect Light Sensor to something.');
  });

  it('asks for a condition input', () => {
    const flow = buildFlow(
      [
        { id: 'c', componentId: 'lessThan' },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' } },
      ],
      [['c', 'a']],
    );
    expect(codes(flow)).toContain('condition-input');
  });

  it('asks for an action on a condition', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' } },
        { id: 'c', componentId: 'lessThan' },
      ],
      [['s', 'c']],
    );
    expect(codes(flow)).toContain('condition-output');
  });

  it('asks for a control block on a card that cannot work without one', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' } },
        { id: 'c', componentId: 'lessThan' },
        { id: 'a', componentId: 'rgb', pins: { red: 'D9', green: 'D10', blue: 'D11' } },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    expect(codes(flow)).toContain('missing-blocks');
  });

  it('accepts a fully configured RGB card', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' } },
        { id: 'c', componentId: 'lessThan' },
        {
          id: 'a',
          componentId: 'rgb',
          pins: { red: 'D9', green: 'D10', blue: 'D11' },
          blocks: [{ id: 'b1', kind: 'color', values: { red: 255, green: 0, blue: 0 } }],
        },
      ],
      [
        ['s', 'c'],
        ['c', 'a'],
      ],
    );
    expect(validateFlow(flow).ok).toBe(true);
  });

  it('accepts a standalone actuator with no input', () => {
    const flow = buildFlow([{ id: 'a', componentId: 'led', pins: { signal: 'D9' } }], []);
    const result = validateFlow(flow);
    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects a sensor connected straight to an action', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' } },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' } },
      ],
      [['s', 'a']],
    );
    const result = validateFlow(flow);
    expect(result.summary).toBe('Add a condition between Light Sensor and LED.');
  });

  it('rejects two conditions in a row', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' } },
        { id: 'c1', componentId: 'lessThan' },
        { id: 'c2', componentId: 'greaterThan' },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' } },
      ],
      [
        ['s', 'c1'],
        ['c1', 'c2'],
        ['c2', 'a'],
      ],
    );
    expect(codes(flow)).toContain('condition-chain');
  });

  it('detects loops', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' } },
        { id: 'c1', componentId: 'lessThan' },
        { id: 'c2', componentId: 'greaterThan' },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' } },
      ],
      [
        ['s', 'c1'],
        ['c1', 'a'],
        ['c1', 'c2'],
        ['c2', 'c1'],
      ],
    );
    expect(codes(flow)).toContain('cycle');
  });

  it('groups issues by block for badges', () => {
    const flow = buildFlow([{ id: 's', componentId: 'ldr' }], []);
    const result = validateFlow(flow);
    expect(result.byNode['s']?.length).toBe(2);
  });
});
