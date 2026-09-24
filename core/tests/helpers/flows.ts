import type { ControlBlock, Flow, NodeComponentId, PinId } from '../../src';
import { addEdge, addNode, createFlow, createNode } from '../../src';

export interface NodePart {
  id: string;
  componentId: NodeComponentId;
  pins?: Record<string, PinId>;
  fields?: Record<string, number | string | boolean>;
  blocks?: ControlBlock[];
  y?: number;
  x?: number;
}

export function buildFlow(parts: NodePart[], links: [string, string][]): Flow {
  let flow = createFlow('Test project', 'flow_test');
  parts.forEach((part, index) => {
    const created = createNode(
      part.componentId,
      { x: part.x ?? 0, y: part.y ?? index * 140 },
      part.id,
    );
    const pins = { ...created.config.pins };
    for (const [key, pin] of Object.entries(part.pins ?? {})) {
      pins[key] = pin;
    }
    flow = addNode(flow, {
      ...created,
      config: {
        pins,
        fields: { ...created.config.fields, ...(part.fields ?? {}) },
        ...(part.blocks ? { blocks: part.blocks } : {}),
      },
    });
  });
  for (const [source, target] of links) {
    flow = addEdge(flow, source, target, `edge_${source}_${target}`);
  }
  return flow;
}

/** The canonical acceptance-test flow: Light Sensor A0 -> Less Than 300 -> LED D9. */
export function lightLedFlow(): Flow {
  return buildFlow(
    [
      { id: 'sensor_light', componentId: 'ldr', pins: { signal: 'A0' }, y: 0 },
      { id: 'cond_less', componentId: 'lessThan', fields: { value: 300 }, y: 140 },
      { id: 'act_led', componentId: 'led', pins: { signal: 'D9' }, fields: { whenTrue: 'on' }, y: 280 },
    ],
    [
      ['sensor_light', 'cond_less'],
      ['cond_less', 'act_led'],
    ],
  );
}
