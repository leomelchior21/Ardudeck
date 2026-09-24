import { getComponent } from '../components/registry';
import type { ComponentDef } from '../components/types';
import { incomingEdge, outgoingEdges } from '../graph/factory';
import type { ControlBlock, Flow, FlowEdge, FlowNode } from '../graph/types';
import { toIdentifier, uniqueName } from '../codegen/cpp-names';
import type { IrAction, IrCondition, IrProgram, IrRead, IrRule } from './types';
import { IR_VERSION } from './types';

export type BuildIrResult = { ok: true; program: IrProgram } | { ok: false; error: string };

const CONDITION_OPS: Record<string, IrCondition['op'] | undefined> = {
  lessThan: 'lt',
  greaterThan: 'gt',
  equalsTo: 'eq',
  lessThanOrEqual: 'lte',
  greaterThanOrEqual: 'gte',
  notEquals: 'neq',
};

/** Visual top-to-bottom order, so generated code is stable and readable. */
function orderNodes(nodes: readonly FlowNode[]): FlowNode[] {
  return [...nodes].sort((a, b) => {
    if (a.position.y !== b.position.y) return a.position.y - b.position.y;
    if (a.position.x !== b.position.x) return a.position.x - b.position.x;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
}

function fieldString(node: FlowNode, id: string, fallback: string): string {
  const value = node.config.fields[id];
  return typeof value === 'string' ? value : fallback;
}

function fieldNumber(node: FlowNode, id: string, fallback: number): number {
  const value = node.config.fields[id];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function pinOf(node: FlowNode, pinId: string) {
  return node.config.pins[pinId];
}

function readFor(node: FlowNode, def: ComponentDef, varName: string): IrRead | string {
  const kind = def.reading?.kind;
  if (kind === 'digital') {
    const pin = pinOf(node, 'signal');
    if (!pin) return `Choose a pin for ${def.name}.`;
    const hasWiring = def.fields.some((field) => field.id === 'wiring');
    return {
      id: node.id,
      name: def.name,
      var: varName,
      kind: 'digital',
      pin,
      pullup: hasWiring && fieldString(node, 'wiring', 'gnd') === 'gnd',
    };
  }
  if (def.id === 'ultrasonic') {
    const trigPin = pinOf(node, 'trig');
    const echoPin = pinOf(node, 'echo');
    if (!trigPin || !echoPin) return `Choose pins for ${def.name}.`;
    return { id: node.id, name: def.name, var: varName, kind: 'distance', trigPin, echoPin };
  }
  const pin = pinOf(node, 'signal');
  if (!pin) return `Choose a pin for ${def.name}.`;
  return { id: node.id, name: def.name, var: varName, kind: 'analog', pin };
}

function clampField(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function blockNumber(block: ControlBlock, id: string, fallback: number): number {
  const value = block.values?.[id];
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function waitAction(
  node: FlowNode,
  def: ComponentDef,
  actionVar: string,
  block: ControlBlock,
): IrAction {
  return {
    nodeId: node.id,
    name: def.name,
    var: actionVar,
    op: 'delay',
    ms: Math.max(0, blockNumber(block, 'ms', 500)),
  };
}

/**
 * Turns the blocks a student stacked on an actuator card into IR actions, in
 * the order they appear. A card can therefore hold a small sequence like
 * HIGH -> DELAY 500 -> LOW -> DELAY 500.
 */
function blockActions(
  node: FlowNode,
  def: ComponentDef,
  actionVar: string,
): IrAction[] | string {
  const blocks = node.config.blocks ?? [];

  if (def.id === 'led' || def.id === 'relay') {
    const pin = pinOf(node, 'signal');
    if (!pin) return `Choose a pin for ${def.name}.`;
    const load = def.id === 'relay' ? fieldString(node, 'load', 'fan') : '';
    const base = {
      nodeId: node.id,
      name: load ? `${def.name} (${load})` : def.name,
      var: actionVar,
      pin,
    };
    const actions: IrAction[] = [];
    for (const block of blocks) {
      if (block.kind === 'high') actions.push({ ...base, op: 'digitalWrite', value: 1 });
      else if (block.kind === 'low') actions.push({ ...base, op: 'digitalWrite', value: 0 });
      else if (block.kind === 'delay') actions.push(waitAction(node, def, actionVar, block));
    }
    return actions;
  }

  if (def.id === 'buzzer') {
    const pin = pinOf(node, 'signal');
    if (!pin) return `Choose a pin for ${def.name}.`;
    const base = { nodeId: node.id, name: def.name, var: actionVar, pin };
    const actions: IrAction[] = [];
    for (const block of blocks) {
      if (block.kind === 'tone') {
        actions.push({
          ...base,
          op: 'tone',
          frequency: clampField(blockNumber(block, 'frequency', 440), 100, 2000),
          durationMs: clampField(blockNumber(block, 'durationMs', 200), 30, 2000),
        });
      } else if (block.kind === 'silent') {
        actions.push({ ...base, op: 'stopTone' });
      } else if (block.kind === 'delay') {
        actions.push(waitAction(node, def, actionVar, block));
      }
    }
    return actions;
  }

  if (def.id === 'servo' || def.id === 'servo360') {
    const pin = pinOf(node, 'signal');
    if (!pin) return `Choose a pin for ${def.name}.`;
    const base = { nodeId: node.id, name: def.name, var: actionVar, pin };
    const actions: IrAction[] = [];
    for (const block of blocks) {
      if (def.id === 'servo' && block.kind === 'angle') {
        actions.push({
          ...base,
          op: 'servoWrite',
          angle: clampField(blockNumber(block, 'angle', 90), 0, 180),
        });
      } else if (def.id === 'servo360' && block.kind === 'speed') {
        actions.push({
          ...base,
          op: 'servoWrite',
          angle: clampField(blockNumber(block, 'speed', 120), 0, 180),
        });
      } else if (block.kind === 'delay') {
        actions.push(waitAction(node, def, actionVar, block));
      }
    }
    return actions;
  }

  if (def.id === 'rgb') {
    const redPin = pinOf(node, 'red');
    const greenPin = pinOf(node, 'green');
    const bluePin = pinOf(node, 'blue');
    if (!redPin || !greenPin || !bluePin) return `Choose pins for ${def.name}.`;
    const base = { nodeId: node.id, name: def.name, var: actionVar, pin: redPin };
    const actions: IrAction[] = [];
    for (const block of blocks) {
      if (block.kind === 'color' || block.kind === 'high' || block.kind === 'low') {
        const fallback = block.kind === 'low' ? 0 : 255;
        actions.push({
          ...base,
          op: 'rgbWrite',
          redPin,
          greenPin,
          bluePin,
          red: clampField(blockNumber(block, 'red', fallback), 0, 255),
          green: clampField(blockNumber(block, 'green', fallback), 0, 255),
          blue: clampField(blockNumber(block, 'blue', fallback), 0, 255),
        });
      } else if (block.kind === 'delay') {
        actions.push(waitAction(node, def, actionVar, block));
      }
    }
    return actions;
  }

  if (def.id === 'motor') {
    const in1 = pinOf(node, 'in1');
    const in2 = pinOf(node, 'in2');
    const enable = pinOf(node, 'enable');
    if (!in1 || !in2 || !enable) return `Choose pins for ${def.name}.`;
    const base = { nodeId: node.id, name: def.name, var: actionVar, pin: in1 };
    const actions: IrAction[] = [];
    for (const block of blocks) {
      const direction =
        block.kind === 'forward' ||
        block.kind === 'reverse' ||
        block.kind === 'brake' ||
        block.kind === 'stop'
          ? block.kind
          : undefined;
      if (direction) {
        actions.push({
          ...base,
          op: 'motorWrite',
          in2Pin: in2,
          enablePin: enable,
          direction,
          speed: clampField(blockNumber(block, 'speed', 200), 0, 255),
        });
      } else if (block.kind === 'delay') {
        actions.push(waitAction(node, def, actionVar, block));
      }
    }
    return actions;
  }

  return `This action is not supported yet: ${def.name}.`;
}

/**
 * The state an actuator falls back to on the opposite branch, so a card that
 * ran a sequence never stays stuck on.
 */
function restActions(node: FlowNode, def: ComponentDef, actionVar: string): IrAction[] | string {
  if (def.id === 'rgb') {
    const redPin = pinOf(node, 'red');
    const greenPin = pinOf(node, 'green');
    const bluePin = pinOf(node, 'blue');
    if (!redPin || !greenPin || !bluePin) return `Choose pins for ${def.name}.`;
    return [
      {
        nodeId: node.id,
        name: def.name,
        var: actionVar,
        pin: redPin,
        op: 'rgbWrite',
        redPin,
        greenPin,
        bluePin,
        red: 0,
        green: 0,
        blue: 0,
      },
    ];
  }

  if (def.id === 'motor') {
    const in1 = pinOf(node, 'in1');
    const in2 = pinOf(node, 'in2');
    const enable = pinOf(node, 'enable');
    if (!in1 || !in2 || !enable) return `Choose pins for ${def.name}.`;
    return [
      {
        nodeId: node.id,
        name: def.name,
        var: actionVar,
        pin: in1,
        op: 'motorWrite',
        in2Pin: in2,
        enablePin: enable,
        direction: 'stop',
        speed: 0,
      },
    ];
  }

  const pin = pinOf(node, 'signal');
  if (!pin) return `Choose a pin for ${def.name}.`;

  if (def.id === 'led' || def.id === 'relay') {
    const load = def.id === 'relay' ? fieldString(node, 'load', 'fan') : '';
    return [
      {
        nodeId: node.id,
        name: load ? `${def.name} (${load})` : def.name,
        var: actionVar,
        pin,
        op: 'digitalWrite',
        value: 0,
      },
    ];
  }

  if (def.id === 'buzzer') {
    return [{ nodeId: node.id, name: def.name, var: actionVar, pin, op: 'stopTone' }];
  }

  if (def.id === 'servo') {
    return [
      {
        nodeId: node.id,
        name: def.name,
        var: actionVar,
        pin,
        op: 'servoWrite',
        angle: clampField(fieldNumber(node, 'restAngle', 0), 0, 180),
      },
    ];
  }

  if (def.id === 'servo360') {
    return [
      {
        nodeId: node.id,
        name: def.name,
        var: actionVar,
        pin,
        op: 'servoWrite',
        angle: clampField(fieldNumber(node, 'restSpeed', 90), 0, 180),
      },
    ];
  }

  return [];
}

function actionsFor(
  node: FlowNode,
  def: ComponentDef,
  actionVar: string,
  whenTrue: boolean,
): IrAction[] | string {
  if (def.id === 'delay') {
    // A wait has no inverse: it only happens on the branch it is wired to.
    if (!whenTrue) return [];
    return [
      {
        nodeId: node.id,
        name: def.name,
        var: actionVar,
        op: 'delay',
        ms: Math.max(0, Math.round(fieldNumber(node, 'ms', 500))),
      },
    ];
  }

  const blocks = node.config.blocks ?? [];
  if (blocks.length > 0) {
    return whenTrue ? blockActions(node, def, actionVar) : restActions(node, def, actionVar);
  }

  const pin = pinOf(node, 'signal');
  if (!pin) return `Choose a pin for ${def.name}.`;
  const base = { nodeId: node.id, name: def.name, var: actionVar, pin };

  if (def.id === 'led' || def.id === 'relay') {
    const onWhenTrue = fieldString(node, 'whenTrue', 'on') === 'on';
    const on = whenTrue ? onWhenTrue : !onWhenTrue;
    const load = def.id === 'relay' ? fieldString(node, 'load', 'fan') : '';
    return [
      {
        ...base,
        name: load ? `${def.name} (${load})` : def.name,
        op: 'digitalWrite',
        value: on ? 1 : 0,
      },
    ];
  }

  if (def.id === 'buzzer') {
    const beepWhenTrue = fieldString(node, 'whenTrue', 'beep') === 'beep';
    const beep = whenTrue ? beepWhenTrue : !beepWhenTrue;
    if (!beep) return [{ ...base, op: 'stopTone' }];
    return [
      {
        ...base,
        op: 'tone',
        frequency: Math.round(fieldNumber(node, 'frequency', 440)),
        durationMs: Math.round(fieldNumber(node, 'durationMs', 200)),
      },
    ];
  }

  if (def.id === 'servo' || def.id === 'servo360') {
    const angle =
      def.id === 'servo360'
        ? whenTrue
          ? fieldNumber(node, 'speedTrue', 120)
          : fieldNumber(node, 'restSpeed', 90)
        : whenTrue
          ? fieldNumber(node, 'angle', 90)
          : fieldNumber(node, 'restAngle', 0);
    return [{ ...base, op: 'servoWrite', angle: Math.round(angle) }];
  }

  return `This action is not supported yet: ${def.name}.`;
}

/**
 * Builds the intermediate representation from a validated flow. If the flow has
 * not been validated this returns a readable error instead of a partial result.
 */
export function buildIr(flow: Flow): BuildIrResult {
  const ordered = orderNodes(flow.nodes);
  const taken = new Set<string>();
  const readVars = new Map<string, string>();
  const actionVars = new Map<string, string>();
  const reads: IrRead[] = [];

  for (const node of ordered) {
    const def = getComponent(node.componentId);
    if (!def) continue;
    const varName = uniqueName(toIdentifier(def.varBase, 'block'), taken);
    if (def.category === 'sensor') {
      const read = readFor(node, def, varName);
      if (typeof read === 'string') return { ok: false, error: read };
      readVars.set(node.id, varName);
      reads.push(read);
    } else if (def.category === 'actuator') {
      actionVars.set(node.id, varName);
    }
  }

  const rules: IrRule[] = [];

  for (const node of ordered) {
    const def = getComponent(node.componentId);
    if (!def || def.category !== 'condition') continue;

    const op = CONDITION_OPS[def.id];
    if (!op) return { ok: false, error: `${def.name} is not supported yet.` };

    const sourceEdge = incomingEdge(flow, node.id);
    const sourceNode = sourceEdge
      ? flow.nodes.find((candidate) => candidate.id === sourceEdge.source)
      : undefined;
    if (!sourceNode) return { ok: false, error: 'This condition needs an input.' };
    const varName = readVars.get(sourceNode.id);
    if (!varName) return { ok: false, error: 'This condition needs a sensor input.' };

    const then: IrAction[] = [];
    const elseActions: IrAction[] = [];

    // Actions run in the order they are placed on the canvas (top to bottom),
    // so a Delay above an LED waits first, and a Delay below it waits after.
    const connected = outgoingEdges(flow, node.id)
      .map((edge) => ({
        edge,
        actuator: flow.nodes.find((candidate) => candidate.id === edge.target),
      }))
      .filter(
        (entry): entry is { edge: FlowEdge; actuator: FlowNode } => entry.actuator !== undefined,
      )
      .sort((a, b) => {
        if (a.actuator.position.y !== b.actuator.position.y) {
          return a.actuator.position.y - b.actuator.position.y;
        }
        if (a.actuator.position.x !== b.actuator.position.x) {
          return a.actuator.position.x - b.actuator.position.x;
        }
        return a.edge.id < b.edge.id ? -1 : 1;
      });

    for (const { edge, actuator } of connected) {
      const actuatorDef = getComponent(actuator.componentId);
      if (!actuatorDef) return { ok: false, error: 'This action is not available anymore.' };
      if (!actuatorDef.deployable) {
        return { ok: false, error: `${actuatorDef.name} cannot be deployed yet.` };
      }
      const actionVar = actionVars.get(actuator.id);
      if (!actionVar) return { ok: false, error: `Choose a pin for ${actuatorDef.name}.` };

      const onFalse = (edge.branch ?? 'true') === 'false';
      const trueActions = actionsFor(actuator, actuatorDef, actionVar, true);
      if (typeof trueActions === 'string') return { ok: false, error: trueActions };
      const falseActions = actionsFor(actuator, actuatorDef, actionVar, false);
      if (typeof falseActions === 'string') return { ok: false, error: falseActions };

      if (onFalse) {
        elseActions.push(...trueActions);
        then.push(...falseActions);
      } else {
        then.push(...trueActions);
        elseActions.push(...falseActions);
      }
    }

    rules.push({
      id: node.id,
      var: varName,
      condition: { op, value: Math.round(fieldNumber(node, 'value', 300)) },
      then,
      else: elseActions,
    });
  }

  // Actuator cards with no incoming connection run on their own: the card's
  // control blocks (or its single command) become an unconditional rule, so a
  // simple LED can blink without any sensor.
  for (const node of ordered) {
    const def = getComponent(node.componentId);
    if (!def || def.category !== 'actuator') continue;
    if (incomingEdge(flow, node.id)) continue;
    if (!def.deployable) {
      return { ok: false, error: `${def.name} cannot be deployed yet.` };
    }
    const actionVar = actionVars.get(node.id);
    if (!actionVar) return { ok: false, error: `Choose a pin for ${def.name}.` };

    const actions = actionsFor(node, def, actionVar, true);
    if (typeof actions === 'string') return { ok: false, error: actions };
    if (actions.length === 0) continue;

    rules.push({
      id: node.id,
      var: '',
      condition: { op: 'always', value: 0 },
      then: actions,
      else: [],
    });
  }

  if (rules.length === 0) {
    return { ok: false, error: 'Add a condition and an action to your flow.' };
  }

  const needsDistance = reads.some((read) => read.kind === 'distance');

  return {
    ok: true,
    program: {
      version: IR_VERSION,
      title: flow.name,
      loopDelayMs: needsDistance ? 60 : 50,
      reads,
      rules,
    },
  };
}
