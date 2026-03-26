import { useAppStore } from '../../store/useAppStore'
import type { Node } from 'reactflow'

const BLOCK_TYPES = [
  { type: 'conditionNode', label: 'Condition', color: '#22c55e', textColor: '#fff' },
  { type: 'logicNode',     label: 'AND',       color: '#f97316', textColor: '#fff', data: { label: 'AND', logicType: 'AND' } },
  { type: 'logicNode',     label: 'OR',        color: '#eab308', textColor: '#1a1a1a', data: { label: 'OR', logicType: 'OR' } },
  { type: 'timerNode',     label: 'Timer',     color: '#06b6d4', textColor: '#fff' },
  { type: 'delayNode',     label: 'Delay',     color: '#a855f7', textColor: '#fff' },
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
        x: 120 + Math.random() * 200,
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
        borderBottom: '4px solid #2d2d2d',
        padding: '10px 14px',
        display: 'flex',
        alignItems: 'center',
        gap: 7,
        flexWrap: 'wrap',
        background: '#e8e4d0',
        flexShrink: 0,
      }}
    >
      {/* Panel title */}
      <span
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 11,
          fontWeight: 'bold',
          color: '#1a1a1a',
          marginRight: 6,
          letterSpacing: 0.5,
        }}
      >
        Logic Flowchart
      </span>

      <div style={{ width: 3, height: 22, background: '#2d2d2d', flexShrink: 0 }} />

      {/* Block type buttons with radio dot */}
      {BLOCK_TYPES.map(bt => (
        <button
          key={`${bt.type}_${bt.label}`}
          className="pixel-btn"
          style={{
            background: bt.color,
            color: bt.textColor,
            fontSize: 9,
            padding: '8px 12px',
            border: '4px solid #2d2d2d',
            boxShadow: '4px 4px 0 #2d2d2d',
            gap: 7,
          }}
          onClick={() => addNode(bt.type, bt.label, bt.data)}
        >
          {/* Radio dot indicator */}
          <span style={{
            display: 'inline-block',
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.9)',
            border: '2px solid rgba(0,0,0,0.5)',
            flexShrink: 0,
          }} />
          {bt.label}
        </button>
      ))}

      {/* Right group */}
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 7, flexShrink: 0 }}>
        <button
          className="pixel-btn pixel-btn-gray"
          style={{ fontSize: 8, padding: '8px 12px' }}
          onClick={handleReset}
        >
          Reset Project
        </button>
        <button
          className="pixel-btn pixel-btn-blue"
          style={{ fontSize: 8, padding: '8px 12px' }}
          onClick={handleAutoArrange}
        >
          Auto Arrange
        </button>
      </div>
    </div>
  )
}
