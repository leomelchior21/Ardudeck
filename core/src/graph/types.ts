import type { PinId } from '../components/pins';
import type { NodeComponentId } from '../components/types';

export const FLOW_VERSION = 1;

/**
 * One stacked command on an actuator card, e.g. HIGH, ANGLE 90 or DELAY 500.
 * `values` holds the block numbers (angle, speed, wait, colour channels).
 */
export interface ControlBlock {
  id: string;
  kind: string;
  values?: Record<string, number>;
}

/** Everything a student can change on a node. Pins and settings are separate so
 *  the validator can apply pin rules without inspecting component-specific settings. */
export interface NodeConfig {
  pins: Record<string, PinId | undefined>;
  fields: Record<string, number | string | boolean>;
  blocks?: ControlBlock[];
}

export interface NodePosition {
  x: number;
  y: number;
}

export interface FlowNode {
  id: string;
  componentId: NodeComponentId;
  position: NodePosition;
  config: NodeConfig;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  /**
   * Which branch of a condition this connection leaves from. Older projects
   * have no branch and behave as "true", which is exactly what the original
   * one-output condition used to mean.
   */
  branch?: 'true' | 'false';
}

export interface Flow {
  version: typeof FLOW_VERSION;
  id: string;
  name: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  updatedAt: string;
}

export interface FlowSummary {
  id: string;
  name: string;
  updatedAt: string;
  nodeCount: number;
  deployedAt?: string;
}
