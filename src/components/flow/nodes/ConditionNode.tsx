import { Handle, Position, type NodeProps } from 'reactflow'
import { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'

export function ConditionNode({ data, id, selected }: NodeProps) {
  const flowNodes = useAppStore(s => s.flowNodes)
  const setFlowNodes = useAppStore(s => s.setFlowNodes)
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState((data.label as string) || 'Condition')

  const remove = () => setFlowNodes(flowNodes.filter(n => n.id !== id))
  const save = () => {
    setFlowNodes(flowNodes.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n))
    setEditing(false)
  }

  return (
    <div style={{ position: 'relative', fontFamily: 'var(--font-pixel)' }}>
      <Handle type="target" position={Position.Top}
        style={{ background: '#2d2d2d', width: 12, height: 12, border: '3px solid #fff' }} />

      <div style={{
        background: '#22c55e',
        border: selected ? '4px solid #f5c518' : '4px solid #2d2d2d',
        boxShadow: '4px 4px 0 #2d2d2d',
        padding: '10px 18px',
        minWidth: 180,
        textAlign: 'center',
        borderRadius: 4,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          {editing ? (
            <input autoFocus value={label}
              onChange={e => setLabel(e.target.value)}
              onBlur={save} onKeyDown={e => e.key === 'Enter' && save()}
              style={{
                fontFamily: 'var(--font-pixel)', fontSize: 9, border: '2px solid #fff',
                background: 'rgba(255,255,255,0.2)', color: '#fff', textAlign: 'center',
                outline: 'none', width: '100%', padding: '2px 4px',
              }}
            />
          ) : (
            <span style={{ fontSize: 9, color: '#fff', fontWeight: 'bold', lineHeight: 1.6, cursor: 'text' }}
              onDoubleClick={() => setEditing(true)}>
              {data.label as string}?
            </span>
          )}
          <button onClick={remove} style={{
            background: 'rgba(0,0,0,0.2)', border: '2px solid rgba(0,0,0,0.3)',
            cursor: 'pointer', fontSize: 9, color: '#fff', padding: '1px 4px', lineHeight: 1, flexShrink: 0,
          }}>✕</button>
        </div>
      </div>

      {/* Yes handle — left side bottom */}
      <Handle type="source" position={Position.Bottom} id="yes"
        style={{ background: '#22c55e', width: 12, height: 12, border: '3px solid #2d2d2d', left: '28%' }} />
      {/* No handle — right side bottom */}
      <Handle type="source" position={Position.Bottom} id="no"
        style={{ background: '#f97316', width: 12, height: 12, border: '3px solid #2d2d2d', left: '72%' }} />

      {/* Yes / No labels */}
      <div style={{
        position: 'absolute', bottom: -22, left: 'calc(28% - 14px)',
        fontFamily: 'var(--font-pixel)', fontSize: 7,
        background: '#22c55e', color: '#fff', padding: '2px 6px',
        border: '2px solid #2d2d2d', whiteSpace: 'nowrap',
      }}>Yes</div>
      <div style={{
        position: 'absolute', bottom: -22, left: 'calc(72% - 8px)',
        fontFamily: 'var(--font-pixel)', fontSize: 7,
        background: '#f97316', color: '#fff', padding: '2px 6px',
        border: '2px solid #2d2d2d', whiteSpace: 'nowrap',
      }}>No</div>
    </div>
  )
}
