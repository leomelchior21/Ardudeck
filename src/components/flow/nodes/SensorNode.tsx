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
        boxShadow: '4px 4px 0 #2d2d2d',
        padding: '9px 14px',
        minWidth: 150,
        fontFamily: 'var(--font-pixel)',
        borderRadius: 4,
      }}
    >
      <Handle type="source" position={Position.Bottom}
        style={{ background: '#2d2d2d', width: 12, height: 12, border: '3px solid #fff' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Radio dot */}
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: '#fff', border: '3px solid #2d2d2d', flexShrink: 0,
        }} />
        <span style={{ fontSize: 9, color: '#fff', flex: 1, lineHeight: 1.6, fontWeight: 'bold' }}>
          {data.label as string}
        </span>
        <button onClick={remove} style={{
          background: 'rgba(0,0,0,0.2)', border: '2px solid rgba(0,0,0,0.3)',
          cursor: 'pointer', fontSize: 9, color: '#fff', padding: '1px 4px', lineHeight: 1,
        }}>✕</button>
      </div>
    </div>
  )
}
