import { Handle, Position, type NodeProps } from 'reactflow'
import { useAppStore } from '../../../store/useAppStore'
import { useState } from 'react'

export function ActionNode({ data, id, selected }: NodeProps) {
  const setFlowNodes = useAppStore(s => s.setFlowNodes)
  const flowNodes = useAppStore(s => s.flowNodes)
  const remove = () => setFlowNodes(flowNodes.filter(n => n.id !== id))

  return (
    <div style={{
      background: '#f5a623',
      border: selected ? '4px solid #f5c518' : '4px solid #2d2d2d',
      boxShadow: '4px 4px 0 #2d2d2d',
      minWidth: 180,
      fontFamily: 'var(--font-pixel)',
      overflow: 'hidden',
      borderRadius: 4,
    }}>
      <Handle type="target" position={Position.Top}
        style={{ background: '#2d2d2d', width: 12, height: 12, border: '3px solid #fff' }} />

      {/* Header */}
      <div style={{
        padding: '8px 10px', display: 'flex', alignItems: 'center', gap: 6,
        borderBottom: '3px solid #2d2d2d', background: '#f5a623',
      }}>
        <span style={{ fontSize: 14 }}>🎮</span>
        <span style={{ fontSize: 9, fontWeight: 'bold', color: '#1a1a1a', flex: 1, lineHeight: 1.4 }}>
          {data.label as string}
        </span>
        <button onClick={remove} style={{
          background: 'rgba(0,0,0,0.15)', border: '2px solid rgba(0,0,0,0.2)',
          cursor: 'pointer', fontSize: 9, padding: '1px 4px', lineHeight: 1,
        }}>✕</button>
      </div>

      {/* Action items */}
      <div style={{ background: '#fff8e7', padding: '6px 8px' }}>
        <ActionItems nodeId={id} items={(data.items as string[]) ?? []} />
      </div>

      <Handle type="source" position={Position.Bottom}
        style={{ background: '#2d2d2d', width: 12, height: 12, border: '3px solid #fff' }} />
    </div>
  )
}

function ActionItems({ nodeId, items }: { nodeId: string; items: string[] }) {
  const flowNodes = useAppStore(s => s.flowNodes)
  const setFlowNodes = useAppStore(s => s.setFlowNodes)
  const [newItem, setNewItem] = useState('')

  const addItem = () => {
    if (!newItem.trim()) return
    setFlowNodes(flowNodes.map(n => n.id === nodeId
      ? { ...n, data: { ...n.data, items: [...items, newItem.trim()] } } : n))
    setNewItem('')
  }

  const removeItem = (idx: number) => {
    setFlowNodes(flowNodes.map(n => n.id === nodeId
      ? { ...n, data: { ...n.data, items: items.filter((_, i) => i !== idx) } } : n))
  }

  return (
    <div>
      {items.map((item, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 4,
          padding: '4px 6px', marginBottom: 3,
          background: '#fffef0', border: '2px solid #2d2d2d',
        }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 7, flex: 1, lineHeight: 1.8 }}>{item}</span>
          <button onClick={() => removeItem(i)} style={{
            background: 'none', border: 'none', cursor: 'pointer', fontSize: 11, padding: 0, lineHeight: 1,
          }}>🗑️</button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 3, marginTop: items.length > 0 ? 4 : 0 }}>
        <input value={newItem} onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="Add action..."
          style={{
            fontFamily: 'var(--font-pixel)', fontSize: 7, border: '2px solid #2d2d2d',
            padding: '3px 5px', flex: 1, background: '#fffef0', outline: 'none',
          }}
        />
        <button onClick={addItem} style={{
          fontFamily: 'var(--font-pixel)', fontSize: 7,
          background: '#22c55e', color: '#fff', border: '2px solid #2d2d2d',
          cursor: 'pointer', padding: '3px 7px', lineHeight: 1,
        }}>+</button>
      </div>
    </div>
  )
}
