import { describe, expect, it } from 'vitest';
import {
  addEdge,
  addNode,
  cloneFlow,
  createFlow,
  createNode,
  defaultConfig,
  outgoingEdges,
  parseFlow,
  removeNodes,
} from '../src';
import { buildFlow, lightLedFlow } from './helpers/flows';

describe('graph factory', () => {
  it('creates nodes with default pins and settings', () => {
    const node = createNode('led', { x: 0, y: 0 }, 'led_1');
    expect(node.id).toBe('led_1');
    expect(node.config.pins['signal']).toBeUndefined();
    expect(node.config.fields['whenTrue']).toBe('on');
  });

  it('gives every pin spec a config slot', () => {
    const config = defaultConfig('ultrasonic');
    expect(Object.keys(config.pins).sort()).toEqual(['echo', 'trig']);
  });

  it('replaces the old wire when a sensor gets a second connection', () => {
    let flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' } },
        { id: 'c1', componentId: 'lessThan', y: 140 },
        { id: 'c2', componentId: 'greaterThan', y: 280 },
      ],
      [['s', 'c1']],
    );
    flow = addEdge(flow, 's', 'c2');
    const edges = outgoingEdges(flow, 's');
    expect(edges).toHaveLength(1);
    expect(edges[0]?.target).toBe('c2');
  });

  it('allows one condition to drive several actions', () => {
    let flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' } },
        { id: 'c', componentId: 'lessThan', y: 140 },
        { id: 'a1', componentId: 'led', pins: { signal: 'D9' }, y: 280 },
        { id: 'a2', componentId: 'led', pins: { signal: 'D10' }, y: 420 },
      ],
      [
        ['s', 'c'],
        ['c', 'a1'],
      ],
    );
    flow = addEdge(flow, 'c', 'a2');
    expect(outgoingEdges(flow, 'c')).toHaveLength(2);
  });

  it('refuses connections into sensors and out of actions', () => {
    const flow = buildFlow(
      [
        { id: 's', componentId: 'ldr', pins: { signal: 'A0' } },
        { id: 'a', componentId: 'led', pins: { signal: 'D9' } },
        { id: 'c', componentId: 'lessThan' },
      ],
      [],
    );
    expect(addEdge(flow, 'a', 's').edges).toHaveLength(0);
    expect(addEdge(flow, 's', 's').edges).toHaveLength(0);
    expect(addEdge(flow, 'a', 'c').edges).toHaveLength(0);
  });

  it('removes nodes together with their wires', () => {
    const flow = lightLedFlow();
    const pruned = removeNodes(flow, ['cond_less']);
    expect(pruned.nodes.map((node) => node.id)).toEqual(['sensor_light', 'act_led']);
    expect(pruned.edges).toHaveLength(0);
  });

  it('clones flows with fresh ids', () => {
    const flow = lightLedFlow();
    const copy = cloneFlow(flow, 'Copy');
    expect(copy.name).toBe('Copy');
    expect(copy.id).not.toBe(flow.id);
    expect(copy.nodes[0]?.id).not.toBe(flow.nodes[0]?.id);
    expect(copy.edges[0]?.source).toBe(copy.nodes[0]?.id);
  });

  it('keeps addNode pure', () => {
    const flow = createFlow('x', 'flow_x');
    const next = addNode(flow, createNode('ldr', { x: 1, y: 2 }, 'n1'));
    expect(flow.nodes).toHaveLength(0);
    expect(next.nodes).toHaveLength(1);
  });
});

describe('parseFlow', () => {
  it('rejects unreadable data with a friendly error', () => {
    const result = parseFlow('{ this is not json');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe('This saved project could not be read.');
  });

  it('rejects structures without blocks', () => {
    const result = parseFlow({ name: 'x' });
    expect(result.ok).toBe(false);
  });

  it('round-trips a valid flow', () => {
    const flow = lightLedFlow();
    const result = parseFlow(JSON.parse(JSON.stringify(flow)));
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.flow.nodes).toHaveLength(3);
      expect(result.flow.edges).toHaveLength(2);
    }
  });

  it('drops unknown blocks with a warning instead of failing', () => {
    const result = parseFlow({
      nodes: [
        { id: 'a', componentId: 'laser_cannon', position: { x: 0, y: 0 } },
        { id: 'b', componentId: 'led', position: { x: 0, y: 10 } },
      ],
      edges: [{ id: 'e1', source: 'a', target: 'b' }],
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.flow.nodes.map((node) => node.id)).toEqual(['b']);
      expect(result.warnings.length).toBeGreaterThanOrEqual(1);
      expect(result.flow.edges).toHaveLength(0);
    }
  });

  it('ignores invalid pins', () => {
    const result = parseFlow({
      nodes: [
        {
          id: 'a',
          componentId: 'ldr',
          position: { x: 0, y: 0 },
          config: { pins: { signal: 'X9' }, fields: {} },
        },
      ],
      edges: [],
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.flow.nodes[0]?.config.pins['signal']).toBeUndefined();
  });
});
