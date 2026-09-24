import { isPinCompatible } from '../components/pins';
import type { PinId } from '../components/pins';
import { getComponent } from '../components/registry';
import type { ComponentDef } from '../components/types';
import type { Flow, FlowEdge, FlowNode } from '../graph/types';
import type { ValidationIssue, ValidationResult } from './types';

interface NodeInfo {
  node: FlowNode;
  def: ComponentDef;
}

function collectNodes(flow: Flow, issues: ValidationIssue[]): NodeInfo[] {
  const infos: NodeInfo[] = [];
  for (const node of flow.nodes) {
    const def = getComponent(node.componentId);
    if (!def) {
      issues.push({
        code: 'unknown-block',
        severity: 'error',
        message: 'This block is not available in this version of ArduDeck.',
        nodeId: node.id,
      });
      continue;
    }
    infos.push({ node, def });
  }
  return infos;
}

function checkPins(infos: NodeInfo[], issues: ValidationIssue[]): void {
  const usage = new Map<PinId, { nodeId: string; name: string; label: string }[]>();

  for (const { node, def } of infos) {
    for (const spec of def.pins) {
      const pin = node.config.pins[spec.id];
      if (!pin) {
        issues.push({
          code: 'missing-pin',
          severity: 'error',
          message: `Choose a pin for ${def.name}.`,
          nodeId: node.id,
        });
        continue;
      }
      if (!isPinCompatible(pin, spec.kinds)) {
        issues.push({
          code: 'bad-pin',
          severity: 'error',
          message: `${pin} cannot be used for ${def.name} ${spec.label}.`,
          nodeId: node.id,
        });
        continue;
      }
      const users = usage.get(pin) ?? [];
      users.push({ nodeId: node.id, name: def.name, label: spec.label });
      usage.set(pin, users);
    }
  }

  for (const [pin, users] of usage) {
    for (let i = 0; i < users.length; i += 1) {
      for (let j = i + 1; j < users.length; j += 1) {
        const first = users[i];
        const second = users[j];
        if (!first || !second) continue;
        if (first.nodeId === second.nodeId) {
          issues.push({
            code: 'duplicate-pin',
            severity: 'error',
            message: `${first.label} and ${second.label} cannot share pin ${pin}.`,
            nodeId: first.nodeId,
          });
          continue;
        }
        issues.push({
          code: 'duplicate-pin',
          severity: 'error',
          message: `${first.name} and ${second.name} are using the same pin (${pin}).`,
          nodeId: first.nodeId,
          relatedNodeId: second.nodeId,
        });
      }
    }
  }
}

function hasCycle(nodeIds: readonly string[], edges: readonly FlowEdge[]): boolean {
  const adjacency = new Map<string, string[]>();
  for (const id of nodeIds) adjacency.set(id, []);
  for (const edge of edges) {
    const list = adjacency.get(edge.source);
    if (list) list.push(edge.target);
  }
  const state = new Map<string, 0 | 1 | 2>();
  for (const id of nodeIds) state.set(id, 0);

  const visit = (id: string): boolean => {
    if (state.get(id) === 1) return true;
    if (state.get(id) === 2) return false;
    state.set(id, 1);
    for (const next of adjacency.get(id) ?? []) {
      if (visit(next)) return true;
    }
    state.set(id, 2);
    return false;
  };

  for (const id of nodeIds) {
    if (visit(id)) return true;
  }
  return false;
}

function checkStructure(infos: NodeInfo[], flow: Flow, issues: ValidationIssue[]): void {
  const outgoing = new Map<string, FlowEdge[]>();
  const incoming = new Map<string, FlowEdge[]>();
  for (const { node } of infos) {
    outgoing.set(node.id, []);
    incoming.set(node.id, []);
  }
  for (const edge of flow.edges) {
    outgoing.get(edge.source)?.push(edge);
    incoming.get(edge.target)?.push(edge);
  }

  const byId = new Map(infos.map((info) => [info.node.id, info]));

  for (const { node, def } of infos) {
    const outs = outgoing.get(node.id) ?? [];
    const ins = incoming.get(node.id) ?? [];

    if (def.category === 'sensor') {
      if (ins.length > 0) {
        issues.push({
          code: 'sensor-input',
          severity: 'error',
          message: `${def.name} cannot receive a connection.`,
          nodeId: node.id,
        });
      }
      if (outs.length === 0) {
        issues.push({
          code: 'sensor-output',
          severity: 'error',
          message: `Connect ${def.name} to something.`,
          nodeId: node.id,
        });
      }
      for (const edge of outs) {
        const target = byId.get(edge.target);
        if (!target) continue;
        if (target.def.category === 'sensor') {
          issues.push({
            code: 'sensor-input',
            severity: 'error',
            message: 'Sensors cannot be connected to each other.',
            nodeId: node.id,
            relatedNodeId: target.node.id,
          });
        }
        if (target.def.category === 'actuator') {
          issues.push({
            code: 'sensor-to-actuator',
            severity: 'error',
            message: `Add a condition between ${def.name} and ${target.def.name}.`,
            nodeId: node.id,
            relatedNodeId: target.node.id,
          });
        }
      }
    }

    if (def.category === 'condition') {
      if (ins.length === 0) {
        issues.push({
          code: 'condition-input',
          severity: 'error',
          message: 'This condition needs an input.',
          nodeId: node.id,
        });
      }
      if (outs.length === 0) {
        issues.push({
          code: 'condition-output',
          severity: 'error',
          message: 'Connect an action to this condition.',
          nodeId: node.id,
        });
      }
      for (const edge of outs) {
        const target = byId.get(edge.target);
        if (target?.def.category === 'condition') {
          issues.push({
            code: 'condition-chain',
            severity: 'error',
            message: 'Two conditions in a row are not supported yet.',
            nodeId: node.id,
            relatedNodeId: target.node.id,
          });
        }
      }
    }

    if (def.category === 'actuator') {
      if (ins.length === 0) {
        issues.push({
          code: 'actuator-input',
          severity: 'error',
          message: `Connect something to ${def.name}.`,
          nodeId: node.id,
        });
      }
      if (def.requiresBlocks && (node.config.blocks ?? []).length === 0) {
        issues.push({
          code: 'missing-blocks',
          severity: 'error',
          message: `Add a control block to ${def.name}.`,
          nodeId: node.id,
        });
      }
      if (outs.length > 0) {
        issues.push({
          code: 'actuator-output',
          severity: 'error',
          message: 'Actions cannot be connected to other blocks.',
          nodeId: node.id,
        });
      }
    }
  }

  if (hasCycle(infos.map((info) => info.node.id), flow.edges)) {
    issues.push({
      code: 'cycle',
      severity: 'error',
      message: 'Your flow has a loop. Remove one of the connections.',
    });
  }
}

/**
 * Structural and pin-level validation. Runs on every edit (fast, pure) and
 * again before Live Test and Deploy, so a student can never start a flow that
 * cannot be built.
 */
export function validateFlow(flow: Flow): ValidationResult {
  const issues: ValidationIssue[] = [];

  if (flow.nodes.length === 0) {
    issues.push({ code: 'empty-flow', severity: 'error', message: 'Add a sensor to start.' });
  }

  const infos = collectNodes(flow, issues);
  checkPins(infos, issues);
  checkStructure(infos, flow, issues);

  const errors = issues.filter((issue) => issue.severity === 'error');
  const warnings = issues.filter((issue) => issue.severity === 'warning');

  const byNode: Record<string, ValidationIssue[]> = {};
  for (const issue of issues) {
    if (!issue.nodeId) continue;
    const list = byNode[issue.nodeId] ?? [];
    list.push(issue);
    byNode[issue.nodeId] = list;
  }

  const first = errors[0];
  return {
    ok: errors.length === 0,
    issues,
    errors,
    warnings,
    byNode,
    summary: first ? first.message : 'Ready',
  };
}
