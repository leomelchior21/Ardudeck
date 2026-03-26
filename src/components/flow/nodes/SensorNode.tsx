import { Handle, Position, type NodeProps } from 'reactflow'
import { useAppStore } from '../../../store/useAppStore'

export function SensorNode({ data, id, selected }: NodeProps) {
  const setFlowNodes = useAppStore(s => s.setFlowNodes)
  const flowNodes = useAppStore(s => s.flowNodes)
  const remove = () => setFlowNodes(flowNodes.filter(n => n.id !== id))

  return (
    <div
      style={{
        background: '#4a9eff',
        border: selected ? '4px solid #f5c518' : '4px solid #2d2d2d',
        boxShadow: '5px 5px 0 #2d2d2d',
        padding: '10px 16px',
        minWidth: 160,
        fontFamily: 'var(--font-pixel)',
        borderRadius: 0,
      }}
    >
      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#2d2d2d', width: 14, height: 14, border: '3px solid #fff', borderRadius: 0 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
        {/* Radio dot */}
        <div style={{
          width: 14, height: 14,
          borderRadius: '50%',
          background: '#fff',
          border: '3px solid #2d2d2d',
          flexShrink: 0,
        }} />
        <span style={{
          fontSize: 10,
          color: '#fff',
          flex: 1,
          lineHeight: 1.5,
          fontWeight: 'bold',
          letterSpacing: 0.3,
        }}>
          {data.label as string}
        </span>
        <button
          onClick={remove}
          style={{
            background: 'rgba(0,0,0,0.25)',
            border: '2px solid rgba(0,0,0,0.35)',
            cursor: 'pointer',
            fontSize: 10,
            color: '#fff',
            padding: '2px 5px',
            lineHeight: 1,
          }}
        >✕</button>
      </div>
    </div>
  )
}
