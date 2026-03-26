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
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#2d2d2d', width: 14, height: 14, border: '3px solid #fff', borderRadius: 0 }}
      />

      <div style={{
        background: '#22c55e',
        border: selected ? '4px solid #f5c518' : '4px solid #2d2d2d',
        boxShadow: '5px 5px 0 #2d2d2d',
        padding: '12px 20px',
        minWidth: 190,
        textAlign: 'center',
        borderRadius: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
          {editing ? (
            <input
              autoFocus
              value={label}
              onChange={e => setLabel(e.target.value)}
              onBlur={save}
              onKeyDown={e => e.key === 'Enter' && save()}
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 10,
                border: '2px solid #fff',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                textAlign: 'center',
                outline: 'none',
                width: '100%',
                padding: '3px 5px',
              }}
            />
          ) : (
            <span
              style={{ fontSize: 10, color: '#fff', fontWeight: 'bold', lineHeight: 1.5, cursor: 'text', flex: 1 }}
              onDoubleClick={() => setEditing(true)}
            >
              {data.label as string}?
            </span>
          )}
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
              flexShrink: 0,
            }}
          >✕</button>
        </div>
      </div>

      {/* Yes handle — left */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{
          background: '#22c55e',
          width: 14,
          height: 14,
          border: '3px solid #2d2d2d',
          left: '28%',
          borderRadius: 0,
        }}
      />
      {/* No handle — right */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        style={{
          background: '#f97316',
          width: 14,
          height: 14,
          border: '3px solid #2d2d2d',
          left: '72%',
          borderRadius: 0,
        }}
      />

      {/* Yes chip */}
      <div style={{
        position: 'absolute',
        bottom: -26,
        left: 'calc(28% - 16px)',
        fontFamily: 'var(--font-pixel)',
        fontSize: 8,
        fontWeight: 'bold',
        background: '#4ade80',
        color: '#1a1a1a',
        padding: '3px 8px',
        border: '2px solid #2d2d2d',
        boxShadow: '2px 2px 0 #2d2d2d',
        whiteSpace: 'nowrap',
      }}>Yes</div>

      {/* No chip */}
      <div style={{
        position: 'absolute',
        bottom: -26,
        left: 'calc(72% - 10px)',
        fontFamily: 'var(--font-pixel)',
        fontSize: 8,
        fontWeight: 'bold',
        background: '#fb923c',
        color: '#fff',
        padding: '3px 8px',
        border: '2px solid #2d2d2d',
        boxShadow: '2px 2px 0 #2d2d2d',
        whiteSpace: 'nowrap',
      }}>No</div>
    </div>
  )
}
