import { useCallback, useEffect, useMemo, useState } from 'react';
import type { DragEvent } from 'react';
import {
  Background,
  BackgroundVariant,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from '@xyflow/react';
import type { Connection, NodeChange, NodeTypes } from '@xyflow/react';
import { getComponent } from '@ardudeck/core';
import type { FlowNode, NodeComponentId } from '@ardudeck/core';
import {
  addComponentAt,
  connectNodes,
  deleteEdge,
  deleteNode,
  setNodePosition,
} from '../../state/flowOps';
import { resetHistory, redo, undo } from '../../state/history';
import { getCompiled, project as projectStore } from '../../state/project';
import { resetDeploy, startDeploySync, syncRuntime } from '../../state/deploy';
import { telemetry } from '../../state/telemetry';
import { useStore } from '../../state/store';
import { showToast } from '../../state/toast';
import { CanvasFooter, CanvasHeader, CanvasToolbar } from './CanvasChrome';
import { ComponentTray } from './ComponentTray';
import { FlowPanel } from './panel/FlowPanel';
import { TopNav } from './TopNav';
import { ActuatorNode, ConditionNode, PlaceholderNode, SensorNode } from './nodes/Nodes';
import { placeholderAt, toReactFlowEdges, toReactFlowNodes } from './nodeData';
import type { AnyFlowNode, PlaceholderSpec } from './nodeData';

const NODE_TYPES = {
  ardudeckSensor: SensorNode,
  ardudeckCondition: ConditionNode,
  ardudeckActuator: ActuatorNode,
  ardudeckPlaceholder: PlaceholderNode,
} as unknown as NodeTypes;

export function FlowScreen() {
  return (
    <ReactFlowProvider>
      <FlowBuilder />
    </ReactFlowProvider>
  );
}

function FlowBuilder() {
  const flow = useStore(projectStore, (state) => state.flow);
  const deployedCode = useStore(projectStore, (state) => state.deployedCode);
  const rulesKey = useStore(telemetry, (state) => JSON.stringify(state.rules));
  const outputsKey = useStore(telemetry, (state) => JSON.stringify(state.outputs));
  const running = useStore(telemetry, (state) => state.running);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [panelCollapsed, setPanelCollapsed] = useState(false);
  const [dropActive, setDropActive] = useState(false);
  const { screenToFlowPosition, fitView } = useReactFlow();

  const compiled = getCompiled(flow);
  const validation = compiled.validation;
  const changedSinceDeploy =
    deployedCode !== null &&
    compiled.sketch !== undefined &&
    compiled.sketch.code !== deployedCode;

  const liveState = useMemo(
    () => ({
      running,
      rules: JSON.parse(rulesKey) as Record<string, boolean>,
      outputs: JSON.parse(outputsKey) as Record<string, { state: string }>,
    }),
    [running, rulesKey, outputsKey],
  );

  const nodes = useMemo(
    () => toReactFlowNodes(flow, validation, selectedId),
    [flow, validation, selectedId],
  );
  const edges = useMemo(() => toReactFlowEdges(flow, liveState), [flow, liveState]);

  useEffect(() => {
    startDeploySync();
    resetDeploy(flow.id);
    void syncRuntime();
  }, [flow.id]);

  useEffect(() => {
    resetHistory();
  }, [flow.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      const meta = event.ctrlKey || event.metaKey;
      if (meta && event.key.toLowerCase() === 'z') {
        event.preventDefault();
        if (event.shiftKey) redo();
        else undo();
        return;
      }
      if (meta && event.key.toLowerCase() === 'y') {
        event.preventDefault();
        redo();
        return;
      }
      if ((event.key === 'Delete' || event.key === 'Backspace') && selectedId) {
        event.preventDefault();
        deleteNode(selectedId);
        setSelectedId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const onNodesChange = useCallback((changes: NodeChange<AnyFlowNode>[]) => {
    for (const change of changes) {
      if (change.type === 'position' && change.position) {
        setNodePosition(change.id, change.position);
      } else if (change.type === 'remove') {
        deleteNode(change.id);
      }
    }
  }, []);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const exists = flow.nodes.some((node) => node.id === connection.target);
      if (!exists) {
        showToast('Drop a component on the dashed box instead.', 'warn');
        return;
      }
      const source = flow.nodes.find((node) => node.id === connection.source);
      const sourceDef = source ? getComponent(source.componentId) : undefined;
      if (sourceDef?.category === 'actuator') {
        showToast('Actions are added below the condition, not after another action.', 'warn');
        return;
      }
      const branch =
        connection.sourceHandle === 'false'
          ? ('false' as const)
          : connection.sourceHandle === 'true'
            ? ('true' as const)
            : undefined;
      connectNodes(connection.source, connection.target, branch);
    },
    [flow.nodes],
  );

  const handleAdded = useCallback(
    (node: FlowNode) => {
      setSelectedId(node.id);
      window.setTimeout(
        () => void fitView({ duration: 220, padding: 0.25, maxZoom: 1 }),
        80,
      );
    },
    [fitView],
  );

  const placeComponent = useCallback(
    (componentId: NodeComponentId, spot: PlaceholderSpec | undefined, x: number, y: number) => {
      const def = getComponent(componentId);
      if (!def) return null;
      if (!spot) return addComponentAt(componentId, { x: x - 100, y: y - 30 });

      const expected = spot.kind === 'next' ? 'condition' : 'actuator';
      if (def.category !== expected) {
        showToast(
          spot.kind === 'next'
            ? 'This slot takes a condition.'
            : 'This slot takes an action like an LED or a buzzer.',
          'warn',
        );
        return addComponentAt(componentId, { x: x - 100, y: y - 30 });
      }

      const node = addComponentAt(componentId, spot.position);
      if (!node) return null;

      if (spot.kind === 'next') {
        connectNodes(spot.parentId, node.id);
        return node;
      }
      if (spot.kind === 'true' || spot.kind === 'false') {
        connectNodes(spot.parentId, node.id, spot.kind);
        return node;
      }
      const parentEdge = flow.edges.find((edge) => edge.target === spot.parentId);
      if (parentEdge) {
        connectNodes(parentEdge.source, node.id, parentEdge.branch);
      } else {
        connectNodes(spot.parentId, node.id);
      }
      return node;
    },
    [flow.edges],
  );

  const onDrop = useCallback(
    (event: DragEvent) => {
      event.preventDefault();
      setDropActive(false);
      const componentId = event.dataTransfer.getData(
        'application/ardudeck-component',
      ) as NodeComponentId;
      if (!componentId) return;
      const point = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const spot = placeholderAt(flow, point.x, point.y);
      const node = placeComponent(componentId, spot, point.x, point.y);
      if (node) handleAdded(node);
    },
    [flow, placeComponent, screenToFlowPosition, handleAdded],
  );

  const deleteSelected = () => {
    if (selectedId) {
      deleteNode(selectedId);
      setSelectedId(null);
      return;
    }
    if (selectedEdgeId) {
      deleteEdge(selectedEdgeId);
      setSelectedEdgeId(null);
      showToast('Connection removed.');
    }
  };

  return (
    <div className="fb">
      <TopNav />

      <div className="fb-main">
        <ComponentTray onAdded={handleAdded} />

        <div
          className={`fb-canvas ${dropActive ? 'is-drop-active' : ''}`}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = 'copy';
            if (!dropActive) setDropActive(true);
          }}
          onDragLeave={() => setDropActive(false)}
          onDrop={onDrop}
        >
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={NODE_TYPES}
            onNodesChange={onNodesChange}
            onConnect={onConnect}
            onNodeClick={(_, node) => {
              if (node.type === 'ardudeckPlaceholder') return;
              setSelectedId(node.id);
              setSelectedEdgeId(null);
            }}
            onEdgeClick={(_, edge) => {
              if (!edge.selectable) return;
              setSelectedEdgeId(edge.id);
              setSelectedId(null);
            }}
            onPaneClick={() => {
              setSelectedId(null);
              setSelectedEdgeId(null);
            }}
            connectionRadius={46}
            minZoom={0.35}
            maxZoom={1.8}
            zoomOnDoubleClick={false}
            panOnDrag
            zoomOnPinch
            nodesDraggable
            nodesConnectable
            proOptions={{ hideAttribution: true }}
            defaultViewport={{ x: 40, y: 20, zoom: 1 }}
          >
            <Background variant={BackgroundVariant.Dots} gap={26} size={1.7} color="#2b2833" />
          </ReactFlow>

          <CanvasHeader />
          <CanvasToolbar selectedId={selectedId ?? selectedEdgeId} onDelete={deleteSelected} />
          <CanvasFooter />

          {flow.nodes.length === 0 ? (
            <div className="fb-empty">
              <span className="fb-empty-plus">+</span>
              <h2>Build something real</h2>
              <p>Drag a component from the left, then connect it to a condition and an action.</p>
            </div>
          ) : null}
        </div>

        <FlowPanel
          flow={flow}
          compiled={compiled}
          deployedCode={deployedCode}
          changedSinceDeploy={changedSinceDeploy}
          collapsed={panelCollapsed}
          onToggleCollapse={() => setPanelCollapsed((value) => !value)}
        />
      </div>

      <footer className="fb-footer">
        <span className="fb-footer-version">ARDUDECK v0.2.0</span>
        <span className="fb-footer-motto">Small boards. Big possibilities.</span>
        <span className="fb-footer-right">
          Learn · Build · Create a brighter tomorrow.
        </span>
      </footer>
    </div>
  );
}
