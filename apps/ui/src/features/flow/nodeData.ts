import type { Edge, Node } from '@xyflow/react';
import { MarkerType } from '@xyflow/react';
import { getComponent, outgoingEdges } from '@ardudeck/core';
import type { ComponentCategory, ComponentDef, Flow, FlowNode, ValidationResult } from '@ardudeck/core';

export interface ArdudeckNodeData extends Record<string, unknown> {
  node: FlowNode;
  def: ComponentDef;
  errors: string[];
}

export interface PlaceholderData extends Record<string, unknown> {
  kind: PlaceholderKind;
  parentId: string;
  label: string;
  sub: string;
}

export type PlaceholderKind = 'true' | 'false' | 'action' | 'next';

export type ArdudeckNode = Node<ArdudeckNodeData, 'ardudeckSensor' | 'ardudeckCondition' | 'ardudeckActuator'>;
export type PlaceholderNode = Node<PlaceholderData, 'ardudeckPlaceholder'>;
export type AnyFlowNode = ArdudeckNode | PlaceholderNode;

export const PLACEHOLDER_W = 190;
export const PLACEHOLDER_H = 104;

export function nodeTypeFor(category: ComponentCategory): ArdudeckNode['type'] {
  if (category === 'condition') return 'ardudeckCondition';
  if (category === 'actuator') return 'ardudeckActuator';
  return 'ardudeckSensor';
}

export function placeholderId(parentId: string, kind: PlaceholderKind): string {
  return `ph:${parentId}:${kind}`;
}

export interface PlaceholderSpec {
  id: string;
  kind: PlaceholderKind;
  parentId: string;
  position: { x: number; y: number };
  label: string;
  sub: string;
}

/**
 * Rough on-canvas height of a card, including the control blocks it carries.
 * React Flow measures nodes after render, but placeholders are derived from
 * the pure flow, so an estimate keeps every drop target below its card.
 */
export function estimateNodeHeight(def: ComponentDef, node: FlowNode): number {
  const pinRows = def.pins.length + (def.wiring?.length ?? 0);
  const pinsHeight = Math.max(56, pinRows * 26);
  const blocks = node.config.blocks ?? [];
  const controls =
    def.blocks && def.blocks.length > 0
      ? blocks.length > 0
        ? 40 + Math.ceil(blocks.length / 1.5) * 40
        : 60
      : 0;
  const legacyCommand = blocks.length === 0 && def.blocks ? 45 : 0;
  const body = 28 + 10 + Math.max(56, pinsHeight, 39 + legacyCommand) + controls + 10;
  return Math.max(120, body);
}

/** Nudges a candidate position down until it stops overlapping a real card. */
function freeSpot(
  nodes: readonly FlowNode[],
  x: number,
  y: number,
  neededHeight = PLACEHOLDER_H,
): { x: number; y: number } {
  let candidateY = y;
  for (let guard = 0; guard < 12; guard += 1) {
    const clash = nodes.some((node) => {
      const def = getComponent(node.componentId);
      const height = def ? estimateNodeHeight(def, node) : 120;
      const verticalOverlap =
        candidateY < node.position.y + height + 24 &&
        candidateY + neededHeight + 24 > node.position.y;
      return Math.abs(node.position.x - x) < 190 && verticalOverlap;
    });
    if (!clash) break;
    candidateY += 150;
  }
  return { x, y: candidateY };
}

/**
 * Empty branches and continuations become real drop targets on the canvas.
 * They are derived from the flow, never stored, so they can never drift.
 */
export function placeholdersFor(flow: Flow): PlaceholderSpec[] {
  const specs: PlaceholderSpec[] = [];
  const byId = new Map(flow.nodes.map((node) => [node.id, node]));

  for (const node of flow.nodes) {
    const def = getComponent(node.componentId);
    if (!def) continue;

    if (def.category === 'condition') {
      const outs = outgoingEdges(flow, node.id);
      const hasTrue = outs.some((edge) => (edge.branch ?? 'true') === 'true');
      const hasFalse = outs.some((edge) => (edge.branch ?? 'true') === 'false');
      if (!hasFalse) {
        specs.push({
          id: placeholderId(node.id, 'false'),
          kind: 'false',
          parentId: node.id,
          position: freeSpot(flow.nodes, node.position.x - 350, node.position.y + 220),
          label: 'Drag a component here',
          sub: 'false branch (optional)',
        });
      }
      if (!hasTrue) {
        specs.push({
          id: placeholderId(node.id, 'true'),
          kind: 'true',
          parentId: node.id,
          position: freeSpot(flow.nodes, node.position.x + 350, node.position.y + 220),
          label: 'Drag a component here',
          sub: 'true branch (optional)',
        });
      }
    }

    if (def.category === 'sensor' && outgoingEdges(flow, node.id).length === 0) {
      specs.push({
        id: placeholderId(node.id, 'next'),
        kind: 'next',
        parentId: node.id,
        position: freeSpot(flow.nodes, node.position.x, node.position.y + 210),
        label: 'Add a condition',
        sub: 'or drag any component',
      });
    }
  }

  const lowestActuator = new Map<string, { node: FlowNode; bottom: number }>();
  for (const node of flow.nodes) {
    const def = getComponent(node.componentId);
    if (!def || def.category !== 'actuator') continue;
    const source = flow.edges.find((edge) => edge.target === node.id);
    const condition = source ? byId.get(source.source) : undefined;
    if (!condition) continue;
    const bottom = node.position.y + estimateNodeHeight(def, node);
    const current = lowestActuator.get(condition.id);
    if (!current || bottom > current.bottom) lowestActuator.set(condition.id, { node, bottom });
  }
  for (const { node: actuator, bottom } of lowestActuator.values()) {
    specs.push({
      id: placeholderId(actuator.id, 'action'),
      kind: 'action',
      parentId: actuator.id,
      // Always clear the card, however many control blocks it carries.
      position: freeSpot(flow.nodes, actuator.position.x, bottom + 40),
      label: 'Add another component',
      sub: 'or drag from the left',
    });
  }

  return specs;
}

export function toReactFlowNodes(
  flow: Flow,
  validation: ValidationResult,
  selectedId: string | null,
): AnyFlowNode[] {
  const nodes: AnyFlowNode[] = [];
  for (const node of flow.nodes) {
    const def = getComponent(node.componentId);
    if (!def) continue;
    const issues = validation.byNode[node.id] ?? [];
    nodes.push({
      id: node.id,
      type: nodeTypeFor(def.category),
      position: node.position,
      selected: node.id === selectedId,
      data: { node, def, errors: issues.map((issue) => issue.message) },
    });
  }
  for (const spec of placeholdersFor(flow)) {
    nodes.push({
      id: spec.id,
      type: 'ardudeckPlaceholder',
      position: spec.position,
      selectable: false,
      draggable: false,
      data: {
        kind: spec.kind,
        parentId: spec.parentId,
        label: spec.label,
        sub: spec.sub,
      },
    });
  }
  return nodes;
}

export interface LiveEdgeState {
  running: boolean;
  rules: Record<string, boolean>;
  outputs: Record<string, { state: string }>;
}

const SENSOR_ACCENT: Partial<Record<string, string>> = {
  ldr: 'var(--fb-yellow)',
  ultrasonic: 'var(--fb-sky)',
  temperature: 'var(--fb-coral)',
  humidity: 'var(--fb-sky)',
  rain: 'var(--fb-sky)',
  water: 'var(--fb-sky)',
  touch: 'var(--fb-lime)',
  infrared: '#b9a6ff',
  sound: 'var(--fb-lime)',
  soil: '#c8a06a',
  button: 'var(--fb-lime)',
  potentiometer: 'var(--fb-sky)',
  switch: 'var(--fb-lime)',
  pir: 'var(--fb-lime)',
};

const ACTUATOR_ACCENT: Partial<Record<string, string>> = {
  led: 'var(--fb-coral)',
  buzzer: 'var(--fb-violet)',
  servo: 'var(--fb-sky)',
  servo360: 'var(--fb-sky)',
  relay: 'var(--fb-yellow)',
  rgb: '#b9a6ff',
  motor: 'var(--fb-coral)',
  delay: '#b9a6ff',
};

export function accentFor(def: ComponentDef): string {
  if (def.category === 'actuator') return ACTUATOR_ACCENT[def.id] ?? 'var(--fb-violet)';
  if (def.category === 'condition') return 'var(--fb-violet)';
  return SENSOR_ACCENT[def.id] ?? 'var(--fb-yellow)';
}

function liveEdgeStyle(
  color: string,
  active: boolean,
  dashed: boolean,
  activeColor = '#4ade80',
): { stroke: string; strokeWidth: number; strokeDasharray?: string; opacity?: number } {
  if (active) return { stroke: activeColor, strokeWidth: 3.5 };
  if (dashed) return { stroke: '#5b5668', strokeWidth: 2, strokeDasharray: '7 7' };
  return { stroke: color, strokeWidth: 2.5, opacity: 0.8 };
}

export function toReactFlowEdges(flow: Flow, live: LiveEdgeState): Edge[] {
  const edges: Edge[] = [];
  const byId = new Map(flow.nodes.map((node) => [node.id, node]));

  for (const edge of flow.edges) {
    const source = byId.get(edge.source);
    const target = byId.get(edge.target);
    if (!source || !target) continue;
    const sourceDef = getComponent(source.componentId);
    const targetDef = getComponent(target.componentId);
    if (!sourceDef || !targetDef) continue;

    const branch = edge.branch ?? 'true';
    let color = accentFor(sourceDef);
    let active = false;
    // True wires are green, false wires are red, so the two paths are easy to
    // tell apart. Every real connection is a full stroke.
    let activeColor = '#4ade80';
    const dashed = false;

    if (sourceDef.category === 'condition') {
      const truth = live.rules[source.id];
      if (branch === 'true') {
        active = live.running && truth === true;
        color = active ? '#4ade80' : '#2f7d52';
      } else {
        active = live.running && truth === false;
        activeColor = '#ff6b61';
        color = active ? '#ff6b61' : '#c0423b';
      }
    } else if (sourceDef.category === 'sensor') {
      active = live.running;
    } else if (sourceDef.category === 'actuator') {
      const state = live.outputs[source.id]?.state;
      active = live.running && Boolean(state) && state !== 'OFF' && state !== 'silent';
    }

    edges.push({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: sourceDef.category === 'condition' ? branch : undefined,
      type: 'smoothstep',
      animated: active && sourceDef.category !== 'sensor',
      style: liveEdgeStyle(color, active, dashed, activeColor),
      markerEnd: {
        type: MarkerType.ArrowClosed,
        width: 16,
        height: 16,
        color: active ? activeColor : dashed ? '#5b5668' : color,
      },
    });
  }

  for (const spec of placeholdersFor(flow)) {
    const parent = byId.get(spec.parentId);
    if (!parent) continue;
    const parentDef = getComponent(parent.componentId);
    if (!parentDef) continue;
    let color = '#3b3744';
    let dashed = true;
    let active = false;
    let activeColor = '#4ade80';
    if (parentDef.category === 'condition') {
      const truth = live.rules[parent.id];
      if (spec.kind === 'true') {
        color = '#2f7d52';
        dashed = false;
        active = live.running && truth === true;
      } else {
        active = live.running && truth === false;
        activeColor = '#ff6b61';
        color = active ? '#c0423b' : '#4a2b2b';
      }
    } else if (parentDef.category === 'sensor') {
      color = accentFor(parentDef);
      active = live.running;
    } else {
      const state = live.outputs[parent.id]?.state;
      color = state && state !== 'OFF' && state !== 'silent' ? '#4ade80' : '#8a4a44';
    }
    edges.push({
      id: `phedge:${spec.id}`,
      source: spec.parentId,
      target: spec.id,
      sourceHandle:
        parentDef.category === 'condition'
          ? spec.kind
          : parentDef.category === 'actuator'
            ? 'next'
            : undefined,
      type: 'smoothstep',
      animated: active && parentDef.category !== 'sensor',
      selectable: false,
      focusable: false,
      style: liveEdgeStyle(color, active, dashed, activeColor),
    });
  }

  return edges;
}

export function placeholderAt(
  flow: Flow,
  x: number,
  y: number,
): PlaceholderSpec | undefined {
  return placeholdersFor(flow).find(
    (spec) =>
      x >= spec.position.x - 16 &&
      x <= spec.position.x + PLACEHOLDER_W + 16 &&
      y >= spec.position.y - 16 &&
      y <= spec.position.y + PLACEHOLDER_H + 16,
  );
}
