import { useAppStore } from '../../store/useAppStore'
import type { Node } from 'reactflow'

const BLOCK_TYPES = [
  { type: 'conditionNode', label: 'Condition', color: '#22c55e', icon: '🟢' },
  { type: 'logicNode', label: 'AND', color: '#f97316', icon: '🟠', data: { label: 'AND', logicType: 'AND' } },
  { type: 'logicNode', label: 'OR', color: '#f97316', icon: '🟠', data: { label: 'OR', logicType: 'OR' } },
  { type: 'timerNode', label: 'Timer', color: '#06b6d4', icon: '🔵' },
  { type: 'delayNode', label: 'Delay', color: '#a855f7', icon: '🟣' },
]

export function FlowToolbar() {
  const flowNodes = useAppStore(s => s.flowNodes)
  const setFlowNodes = useAppStore(s => s.setFlowNodes)
  const setFlowEdges = useAppStore(s => s.setFlowEdges)

  const addNode = (type: string, label: string, data?: Record<string, unknown>) => {
    const newNode: Node = {
      id: `${type}_${Date.now()}`,
      type,
      position: {
        x: 100 + Math.random() * 200,
        y: 150 + Math.random() * 100,
      },
      data: {
        label,
        ...(data ?? {}),
      },
    }
    setFlowNodes([...flowNodes, newNode])
  }

  const handleReset = () => {
    if (confirm('Reset the entire flowchart? This cannot be undone.')) {
      setFlowNodes([])
      setFlowEdges([])
    }
  }

  const handleAutoArrange = () => {
    const sensors = flowNodes.filter(n => n.type === 'sensorNode')
    const conditions = flowNodes.filter(n => n.type === 'conditionNode')
    const actions = flowNodes.filter(n => n.type === 'actionNode')
    const other = flowNodes.filter(n =>
      !['sensorNode', 'conditionNode', 'actionNode'].includes(n.type ?? '')
    )

    const arranged: Node[] = [
      ...sensors.map((n, i) => ({ ...n, position: { x: 80 + i * 220, y: 60 } })),
      ...conditions.map((n, i) => ({ ...n, position: { x: 80 + i * 220, y: 200 } })),
      ...other.map((n, i) => ({ ...n, position: { x: 80 + i * 200, y: 350 } })),
      ...actions.map((n, i) => ({ ...n, position: { x: 80 + i * 220, y: 480 } })),
    ]
    setFlowNodes(arranged)
  }

  return (
    <div
      style={{
        borderBottom: '3px solid #2d2d2d',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexWrap: 'wrap',
        background: '#e8e4d0',
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 10,
          fontWeight: 'bold',
          marginRight: 4,
        }}
      >
        Logic Flowchart
      </span>

      <div style={{ width: 2, height: 20, background: '#2d2d2d' }} />

      {BLOCK_TYPES.map(bt => (
        <button
          key={`${bt.type}_${bt.label}`}
          className="pixel-btn"
          style={{
            background: bt.color,
            color: '#fff',
            fontSize: 8,
            padding: '6px 10px',
            boxShadow: '3px 3px 0 #2d2d2d',
          }}
          onClick={() => addNode(bt.type, bt.label, bt.data)}
        >
          <span>{bt.icon}</span> {bt.label}
        </button>
      ))}

      <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
        <button
          className="pixel-btn pixel-btn-gray"
          style={{ fontSize: 8 }}
          onClick={handleReset}
        >
          Reset Project
        </button>
        <button
          className="pixel-btn pixel-btn-blue"
          style={{ fontSize: 8 }}
          onClick={handleAutoArrange}
        >
          Auto Arrange
        </button>
      </div>
    </div>
  )
}
