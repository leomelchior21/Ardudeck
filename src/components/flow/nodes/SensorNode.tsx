import { Handle, Position, type NodeProps } from 'reactflow'
import { useAppStore } from '../../../store/useAppStore'

export function SensorNode({ data, id, selected }: NodeProps) {
  const setFlowNodes = useAppStore(s => s.setFlowNodes)
  const flowNodes = useAppStore(s => s.flowNodes)

  const remove = () => {
    setFlowNodes(flowNodes.filter(n => n.id !== id))
  }

  return (
    <div
      style={{
        background: '#4a9eff',
        border: selected ? '4px solid #f5c518' : '4px solid #2d2d2d',
        boxShadow: '4px 4px 0 #2d2d2d',
        padding: '8px 14px',
        minWidth: 140,
        fontFamily: 'var(--font-pixel)',
        position: 'relative',
      }}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#2d2d2d', width: 10, height: 10, border: '2px solid #fff' }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span
          style={{
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#fff',
            border: '2px solid #2d2d2d',
            flexShrink: 0,
          }}
        />
        <span style={{ fontSize: 9, color: '#fff', flex: 1, lineHeight: 1.6 }}>
          {data.label as string}
        </span>
        <button
          onClick={remove}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 12,
            color: '#fff',
            padding: 0,
            lineHeight: 1,
          }}
        >
          ✕
        </button>
      </div>
    </div>
  )
}
