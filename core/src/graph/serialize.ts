import { isPinId } from '../components/pins';
import { getComponent } from '../components/registry';
import type { NodeComponentId } from '../components/types';
import { defaultConfig, newId } from './factory';
import type {
  ControlBlock,
  Flow,
  FlowEdge,
  FlowNode,
  NodeConfig,
  NodePosition,
} from './types';
import { FLOW_VERSION } from './types';

export type ParseFlowResult =
  | { ok: true; flow: Flow; warnings: string[] }
  | { ok: false; error: string };

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return undefined;
  return value as Record<string, unknown>;
}

function parsePosition(value: unknown): NodePosition {
  const record = asRecord(value);
  const x = Number(record?.['x']);
  const y = Number(record?.['y']);
  return {
    x: Number.isFinite(x) ? x : 0,
    y: Number.isFinite(y) ? y : 0,
  };
}

function parseBlocks(value: unknown): ControlBlock[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const blocks: ControlBlock[] = [];
  for (const raw of value) {
    const record = asRecord(raw);
    if (!record) continue;
    const kind = record['kind'];
    if (typeof kind !== 'string' || kind.length === 0) continue;
    const id =
      typeof record['id'] === 'string' && record['id'].length > 0 ? record['id'] : newId('block');
    const block: ControlBlock = { id, kind };
    const values = asRecord(record['values']);
    if (values) {
      const numbers: Record<string, number> = {};
      for (const [key, raw] of Object.entries(values)) {
        if (typeof raw === 'number' && Number.isFinite(raw)) numbers[key] = raw;
      }
      if (Object.keys(numbers).length > 0) block.values = numbers;
    }
    blocks.push(block);
  }
  return blocks;
}

function parseConfig(value: unknown, componentId: NodeComponentId): NodeConfig {
  const defaults = defaultConfig(componentId);
  const record = asRecord(value);
  if (!record) return defaults;

  const pins = asRecord(record['pins']);
  const fields = asRecord(record['fields']);
  const config: NodeConfig = { pins: { ...defaults.pins }, fields: { ...defaults.fields } };

  if (pins) {
    for (const [key, raw] of Object.entries(pins)) {
      if (isPinId(raw)) config.pins[key] = raw;
    }
  }
  if (fields) {
    for (const [key, raw] of Object.entries(fields)) {
      if (typeof raw === 'number' || typeof raw === 'string' || typeof raw === 'boolean') {
        config.fields[key] = raw;
      }
    }
  }
  const blocks = parseBlocks(record['blocks']);
  if (blocks) {
    // An explicitly saved empty list means the student removed every block.
    if (blocks.length > 0) config.blocks = blocks;
    else delete config.blocks;
  }
  return config;
}

function parseNode(value: unknown, warnings: string[]): FlowNode | undefined {
  const record = asRecord(value);
  if (!record) return undefined;
  const id = record['id'];
  const componentId = record['componentId'];
  if (typeof id !== 'string' || id.length === 0) return undefined;
  if (typeof componentId !== 'string') return undefined;
  const def = getComponent(componentId);
  if (!def) {
    warnings.push(`A block in this project is no longer available and was removed.`);
    return undefined;
  }
  return {
    id,
    componentId: def.id,
    position: parsePosition(record['position']),
    config: parseConfig(record['config'], def.id),
  };
}

/**
 * Tolerant reader for saved projects. A power cut can leave a partially written
 * file behind, so a malformed project must produce a clear error (or a repaired
 * flow) instead of a crash.
 */
export function parseFlow(raw: unknown): ParseFlowResult {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'This saved project could not be read.' };
    }
  }
  const record = asRecord(value);
  if (!record) return { ok: false, error: 'This saved project could not be read.' };

  const rawNodes = record['nodes'];
  if (!Array.isArray(rawNodes)) {
    return { ok: false, error: 'This saved project has no blocks.' };
  }

  const warnings: string[] = [];
  const seenIds = new Set<string>();
  const nodes: FlowNode[] = [];
  for (const rawNode of rawNodes) {
    const node = parseNode(rawNode, warnings);
    if (!node) continue;
    if (seenIds.has(node.id)) continue;
    seenIds.add(node.id);
    nodes.push(node);
  }

  const edges: FlowEdge[] = [];
  const rawEdges = record['edges'];
  if (Array.isArray(rawEdges)) {
    for (const rawEdge of rawEdges) {
      const edge = asRecord(rawEdge);
      if (!edge) continue;
      const source = edge['source'];
      const target = edge['target'];
      if (typeof source !== 'string' || typeof target !== 'string') continue;
      if (!seenIds.has(source) || !seenIds.has(target)) {
        warnings.push('A broken connection was removed.');
        continue;
      }
      const id = typeof edge['id'] === 'string' && edge['id'].length > 0 ? edge['id'] : newId('edge');
      if (edges.some((candidate) => candidate.id === id)) continue;
      const branch = edge['branch'];
      const parsed: FlowEdge =
        branch === 'false' ? { id, source, target, branch: 'false' } : { id, source, target };
      edges.push(parsed);
    }
  }

  const name = typeof record['name'] === 'string' && record['name'].trim().length > 0
    ? record['name'].trim()
    : 'Untitled project';
  const id = typeof record['id'] === 'string' && record['id'].length > 0 ? record['id'] : newId('flow');
  const updatedAt =
    typeof record['updatedAt'] === 'string' && record['updatedAt'].length > 0
      ? record['updatedAt']
      : new Date().toISOString();

  return {
    ok: true,
    flow: { version: FLOW_VERSION, id, name, nodes, edges, updatedAt },
    warnings,
  };
}

export function serializeFlow(flow: Flow): string {
  return JSON.stringify(flow, null, 2);
}
