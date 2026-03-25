import { useCallback, useMemo } from 'react'
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
  type Connection,
  type NodeChange,
  type EdgeChange,
  type NodeTypes,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { useAppStore } from '../../store/useAppStore'
import { SensorNode } from './nodes/SensorNode'
import { ActionNode } from './nodes/ActionNode'
import { ConditionNode } from './nodes/ConditionNode'
import { TimerNode } from './nodes/TimerNode'
import { DelayNode } from './nodes/DelayNode'
import { LogicNode } from './nodes/LogicNode'
import { FlowToolbar } from './FlowToolbar'
import { generateFlowSummary } from '../../logic/flowGenerator'

const nodeTypes: NodeTypes = {
  sensorNode: SensorNode,
  actionNode: ActionNode,
  conditionNode: ConditionNode,
  timerNode: TimerNode,
  delayNode: DelayNode,
  logicNode: LogicNode,
}

export function FlowPanel() {
  const flowNodes = useAppStore(s => s.flowNodes)
  const flowEdges = useAppStore(s => s.flowEdges)
  const setFlowNodes = useAppStore(s => s.setFlowNodes)
  const setFlowEdges = useAppStore(s => s.setFlowEdges)
  const components = useAppStore(s => s.components)

  const summary = useMemo(() => generateFlowSummary(components), [components])

  const onConnect = useCallback(
    (connection: Connection) => {
      setFlowEdges(
        addEdge(
          { ...connection, animated: true, style: { stroke: '#2d2d2d', strokeWidth: 3 } },
          flowEdges
        )
      )
    },
    [flowEdges, setFlowEdges]
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setFlowNodes(applyNodeChanges(changes, flowNodes))
    },
    [flowNodes, setFlowNodes]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setFlowEdges(applyEdgeChanges(changes, flowEdges))
    },
    [flowEdges, setFlowEdges]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <FlowToolbar />

      <div style={{ flex: 1, position: 'relative', minHeight: 0 }}>
        <ReactFlow
          nodes={flowNodes}
          edges={flowEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: '#2d2d2d', strokeWidth: 3 },
          }}
          deleteKeyCode="Delete"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={20}
            size={1.5}
            color="#2d2d2d"
            style={{ opacity: 0.15 }}
          />
          <Controls
            style={{
              border: '3px solid #2d2d2d',
              boxShadow: '3px 3px 0 #2d2d2d',
              borderRadius: 0,
            }}
          />
          <MiniMap
            style={{
              border: '3px solid #2d2d2d',
              borderRadius: 0,
            }}
            maskColor="rgba(232,228,208,0.7)"
          />
        </ReactFlow>
      </div>

      {/* Summary footer */}
      <div
        style={{
          borderTop: '3px solid #2d2d2d',
          padding: '10px 16px',
          background: '#f0ead6',
          flexShrink: 0,
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 8,
            lineHeight: 2,
            color: '#333',
          }}
        >
          {summary}
        </p>
      </div>
    </div>
  )
}
