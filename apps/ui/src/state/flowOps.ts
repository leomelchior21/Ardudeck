import {
  addEdge,
  addNode,
  cloneConfig,
  createNode,
  getComponent,
  moveNode,
  removeEdges,
  removeNodes,
  updateNodeConfig,
} from '@ardudeck/core';
import type {
  ComponentCategory,
  Flow,
  FlowNode,
  NodeComponentId,
  NodeConfig,
  NodePosition,
  PinId,
} from '@ardudeck/core';
import { record } from './history';
import { project, setFlow as applyFlow } from './project';

/** Every structural edit goes through here so undo/redo stays honest. */
function setFlow(flow: Flow, remember = true): void {
  if (remember) record(project.get().flow);
  applyFlow(flow);
}

/**
 * Fallback placement when a component is added by clicking instead of
 * dragging. It follows the teaching layout: sensor on top, condition below,
 * actions under it.
 */
const LAYOUT: Record<ComponentCategory, { x: number; y: number; gap: number }> = {
  sensor: { x: 430, y: 30, gap: 150 },
  condition: { x: 430, y: 220, gap: 190 },
  actuator: { x: 680, y: 440, gap: 150 },
};

function categoryOf(componentId: NodeComponentId): ComponentCategory {
  return getComponent(componentId)?.category ?? 'sensor';
}

function nextPosition(flow: Flow, category: ComponentCategory): NodePosition {
  const inColumn = flow.nodes.filter((node) => categoryOf(node.componentId) === category);
  const row = inColumn.length % 3;
  const wrap = Math.floor(inColumn.length / 3);
  const base = LAYOUT[category];
  return {
    x: base.x + wrap * 70,
    y: base.y + row * base.gap,
  };
}

/** Adds a block where the student expects it to appear: in its own column. */
export function addComponent(componentId: NodeComponentId): FlowNode | null {
  const def = getComponent(componentId);
  if (!def) return null;
  const flow = project.get().flow;
  const node = createNode(componentId, nextPosition(flow, def.category));
  setFlow(addNode(flow, node));
  return node;
}

/** Adds a block exactly where it was dropped on the canvas. */
export function addComponentAt(
  componentId: NodeComponentId,
  position: NodePosition,
): FlowNode | null {
  const def = getComponent(componentId);
  if (!def) return null;
  const node = createNode(componentId, position);
  setFlow(addNode(project.get().flow, node));
  return node;
}

export function deleteNode(nodeId: string): void {
  setFlow(removeNodes(project.get().flow, [nodeId]));
}

/** Copy of a card with the same settings and pins, placed next to it. */
export function duplicateNode(nodeId: string): FlowNode | null {
  const flow = project.get().flow;
  const node = flow.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return null;
  const copy = createNode(node.componentId, {
    x: node.position.x + 40,
    y: node.position.y + 40,
  });
  copy.config = cloneConfig(node.config);
  setFlow(addNode(flow, copy));
  return copy;
}

/** Removes every wire attached to a card, keeping the card itself. */
export function disconnectNode(nodeId: string): void {
  const flow = project.get().flow;
  const edges = flow.edges
    .filter((edge) => edge.source === nodeId || edge.target === nodeId)
    .map((edge) => edge.id);
  if (edges.length === 0) return;
  setFlow(removeEdges(flow, edges));
}

export function setNodeConfig(nodeId: string, config: NodeConfig, remember = true): void {
  setFlow(updateNodeConfig(project.get().flow, nodeId, config), remember);
}

export function setNodePosition(nodeId: string, position: NodePosition): void {
  setFlow(moveNode(project.get().flow, nodeId, position), false);
}

export function connectNodes(source: string, target: string, branch?: 'true' | 'false'): void {
  setFlow(addEdge(project.get().flow, source, target, undefined, branch));
}

export function deleteEdge(edgeId: string): void {
  setFlow(removeEdges(project.get().flow, [edgeId]));
}

export function clearFlow(): void {
  setFlow({ ...project.get().flow, nodes: [], edges: [] });
}

/**
 * Switching the comparison operator keeps everything else on the node:
 * the condition stays the same block, only its meaning changes.
 */
export function setConditionOperator(nodeId: string, componentId: NodeComponentId): void {
  const flow = project.get().flow;
  setFlow({
    ...flow,
    nodes: flow.nodes.map((node) =>
      node.id === nodeId ? { ...node, componentId } : node,
    ),
  });
}

/**
 * The bridge from Live Sensor to Flow: build the first half of a rule from
 * what the student just observed on a real sensor.
 */
export function startRuleFromReading(options: {
  componentId: NodeComponentId;
  pins: Record<string, PinId>;
  threshold: number;
  op: 'lessThan' | 'greaterThan' | 'equalsTo';
}): void {
  const flow = project.get().flow;
  const sensorDef = getComponent(options.componentId);
  if (!sensorDef) return;

  const sensor = createNode(options.componentId, nextPosition(flow, 'sensor'));
  const pins: Record<string, PinId | undefined> = { ...sensor.config.pins };
  for (const [key, pin] of Object.entries(options.pins)) pins[key] = pin;

  const condition = createNode(options.op, nextPosition(flow, 'condition'));
  let next = addNode(flow, { ...sensor, config: { ...sensor.config, pins } });
  next = addNode(next, {
    ...condition,
    config: {
      ...condition.config,
      fields: { ...condition.config.fields, value: options.threshold },
    },
  });
  next = addEdge(next, sensor.id, condition.id);
  setFlow(next);
}

export function nodeLabel(componentId: NodeComponentId): string {
  return getComponent(componentId)?.name ?? 'Block';
}
