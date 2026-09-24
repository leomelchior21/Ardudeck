import { getComponent } from '../components/registry';
import type { BlockSpec, NodeComponentId } from '../components/types';
import type {
  ControlBlock,
  Flow,
  FlowEdge,
  FlowNode,
  NodeConfig,
  NodePosition,
} from './types';
import { FLOW_VERSION } from './types';

let idCounter = 0;

export function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}`;
}

/** Builds one control block for an actuator card from its block spec. */
export function createBlock(spec: BlockSpec, id?: string): ControlBlock {
  const block: ControlBlock = { id: id ?? newId('block'), kind: spec.kind };
  const values: Record<string, number> = {};
  for (const number of spec.numbers ?? []) {
    values[number.id] = number.defaultValue;
  }
  if (Object.keys(values).length > 0) block.values = values;
  return block;
}

export function defaultConfig(componentId: NodeComponentId): NodeConfig {
  const def = getComponent(componentId);
  if (!def) return { pins: {}, fields: {} };
  const pins: Record<string, string | undefined> = {};
  for (const pin of def.pins) {
    pins[pin.id] = undefined;
  }
  const fields: Record<string, number | string | boolean> = {};
  for (const field of def.fields) {
    fields[field.id] = field.defaultValue;
  }
  return { pins: pins as NodeConfig['pins'], fields };
}

/**
 * Every brand-new actuator card starts with its default control block, so the
 * card is immediately usable. Restricted to createNode on purpose: reading a
 * saved project keeps its original settings, and only adds blocks that were
 * actually saved.
 */
export function defaultBlocks(componentId: NodeComponentId): ControlBlock[] | undefined {
  const def = getComponent(componentId);
  if (!def?.blocks || def.blocks.length === 0) return undefined;
  const spec =
    def.blocks.find((candidate) => candidate.kind === def.defaultBlock) ?? def.blocks[0];
  return spec ? [createBlock(spec)] : undefined;
}

/** Deep enough copy of a config: blocks and their values are not shared. */
export function cloneConfig(config: NodeConfig): NodeConfig {
  return {
    pins: { ...config.pins },
    fields: { ...config.fields },
    ...(config.blocks
      ? {
          blocks: config.blocks.map((block) => ({
            ...block,
            ...(block.values ? { values: { ...block.values } } : {}),
          })),
        }
      : {}),
  };
}

export function createNode(
  componentId: NodeComponentId,
  position: NodePosition,
  id?: string,
): FlowNode {
  const config = defaultConfig(componentId);
  const blocks = defaultBlocks(componentId);
  if (blocks) config.blocks = blocks;
  return {
    id: id ?? newId(componentId),
    componentId,
    position,
    config,
  };
}

export function createFlow(name: string, id?: string): Flow {
  return {
    version: FLOW_VERSION,
    id: id ?? newId('flow'),
    name,
    nodes: [],
    edges: [],
    updatedAt: new Date().toISOString(),
  };
}

function withUpdated(flow: Flow, nodes: FlowNode[], edges: FlowEdge[]): Flow {
  return { ...flow, nodes, edges, updatedAt: new Date().toISOString() };
}

export function addNode(flow: Flow, node: FlowNode): Flow {
  return withUpdated(flow, [...flow.nodes, node], flow.edges);
}

export function removeNodes(flow: Flow, nodeIds: readonly string[]): Flow {
  const remove = new Set(nodeIds);
  return withUpdated(
    flow,
    flow.nodes.filter((node) => !remove.has(node.id)),
    flow.edges.filter((edge) => !remove.has(edge.source) && !remove.has(edge.target)),
  );
}

export function moveNode(flow: Flow, nodeId: string, position: NodePosition): Flow {
  return withUpdated(
    flow,
    flow.nodes.map((node) => (node.id === nodeId ? { ...node, position } : node)),
    flow.edges,
  );
}

export function updateNodeConfig(flow: Flow, nodeId: string, config: NodeConfig): Flow {
  return withUpdated(
    flow,
    flow.nodes.map((node) => (node.id === nodeId ? { ...node, config } : node)),
    flow.edges,
  );
}

function categoryOf(flow: Flow, nodeId: string): string | undefined {
  const node = flow.nodes.find((candidate) => candidate.id === nodeId);
  if (!node) return undefined;
  return getComponent(node.componentId)?.category;
}

/**
 * Adds a connection the way a student expects: dragging a wire to an input that
 * already has one replaces the old wire. Sensors and actions have a single
 * output; conditions may drive several actions.
 */
export function addEdge(
  flow: Flow,
  source: string,
  target: string,
  id?: string,
  branch?: 'true' | 'false',
): Flow {
  if (source === target) return flow;
  const sourceCategory = categoryOf(flow, source);
  const targetCategory = categoryOf(flow, target);
  if (!sourceCategory || !targetCategory) return flow;
  if (targetCategory === 'sensor') return flow;
  if (sourceCategory === 'actuator') return flow;

  const keep = flow.edges.filter((edge) => {
    if (edge.source === source && sourceCategory !== 'condition') return false;
    if (edge.target === target) return false;
    return !(edge.source === source && edge.target === target);
  });

  const edge: FlowEdge = { id: id ?? newId('edge'), source, target };
  if (branch) edge.branch = branch;
  return withUpdated(flow, flow.nodes, [...keep, edge]);
}

export function removeEdges(flow: Flow, edgeIds: readonly string[]): Flow {
  const remove = new Set(edgeIds);
  return withUpdated(
    flow,
    flow.nodes,
    flow.edges.filter((edge) => !remove.has(edge.id)),
  );
}

/** Deep copy with fresh ids, used by "Duplicate" and by loading templates. */
export function cloneFlow(flow: Flow, name?: string): Flow {
  const idMap = new Map<string, string>();
  const nodes = flow.nodes.map((node) => {
    const id = newId(node.componentId);
    idMap.set(node.id, id);
    return { ...node, id, config: cloneConfig(node.config) };
  });
  const edges = flow.edges.map((edge) => {
    const copy: FlowEdge = {
      id: newId('edge'),
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target,
    };
    if (edge.branch) copy.branch = edge.branch;
    return copy;
  });
  return {
    version: FLOW_VERSION,
    id: newId('flow'),
    name: name ?? flow.name,
    nodes,
    edges,
    updatedAt: new Date().toISOString(),
  };
}

export function incomingEdge(flow: Flow, nodeId: string): FlowEdge | undefined {
  return flow.edges.find((edge) => edge.target === nodeId);
}

export function outgoingEdges(flow: Flow, nodeId: string): FlowEdge[] {
  return flow.edges.filter((edge) => edge.source === nodeId);
}

export function getNode(flow: Flow, nodeId: string): FlowNode | undefined {
  return flow.nodes.find((node) => node.id === nodeId);
}
