import { Handle, Position, type NodeProps } from 'reactflow'
import { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'

export function ConditionNode({ data, id, selected }: NodeProps) {
  const flowNodes = useAppStore(s => s.flowNodes)
  const setFlowNodes = useAppStore(s => s.setFlowNodes)
  const [editing, setEditing] = useState(false)
  const [label, setLabel] = useState((data.label as string) || 'Condition?')

  const remove = () => setFlowNodes(flowNodes.filter(n => n.id !== id))

  const save = () => {
    setFlowNodes(flowNodes.map(n => n.id === id ? { ...n, data: { ...n.data, label } } : n))
    setEditing(false)
  }

  return (
    <div style={{ position: 'relative' }}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#2d2d2d', width: 10, height: 10, border: '2px solid #fff' }}
      />

      {/* Diamond-like shape via skew + inner box */}
      <div
        style={{
          background: '#22c55e',
          border: selected ? '4px solid #f5c518' : '4px solid #2d2d2d',
          boxShadow: '4px 4px 0 #2d2d2d',
          padding: '10px 16px',
          minWidth: 160,
          fontFamily: 'var(--font-pixel)',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'center' }}>
          {editing ? (
            <input
              autoFocus
              value={label}
              onChange={e => setLabel(e.target.value)}
              onBlur={save}
              onKeyDown={e => e.key === 'Enter' && save()}
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 8,
                border: '2px solid #fff',
                background: 'transparent',
                color: '#fff',
                textAlign: 'center',
                outline: 'none',
                width: '100%',
              }}
            />
          ) : (
            <span
              style={{ fontSize: 9, color: '#fff', cursor: 'text', fontWeight: 'bold' }}
              onDoubleClick={() => setEditing(true)}
            >
              {data.label as string}?
            </span>
          )}
          <button onClick={remove} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#fff', padding: 0 }}>✕</button>
        </div>
      </div>

      {/* Yes / No handles with labels */}
      <Handle
        type="source"
        position={Position.Bottom}
        id="yes"
        style={{
          background: '#22c55e',
          width: 10,
          height: 10,
          border: '2px solid #2d2d2d',
          left: '30%',
        }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="no"
        style={{
          background: '#f97316',
          width: 10,
          height: 10,
          border: '2px solid #2d2d2d',
          left: '70%',
        }}
      />

      {/* Labels */}
      <div
        style={{
          position: 'absolute',
          bottom: -20,
          left: 'calc(30% - 12px)',
          fontFamily: 'var(--font-pixel)',
          fontSize: 7,
          background: '#22c55e',
          color: '#fff',
          padding: '1px 5px',
          border: '1px solid #2d2d2d',
        }}
      >
        Yes
      </div>
      <div
        style={{
          position: 'absolute',
          bottom: -20,
          left: 'calc(70% - 8px)',
          fontFamily: 'var(--font-pixel)',
          fontSize: 7,
          background: '#f97316',
          color: '#fff',
          padding: '1px 5px',
          border: '1px solid #2d2d2d',
        }}
      >
        No
      </div>
    </div>
  )
}
