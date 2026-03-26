import { Handle, Position, type NodeProps } from 'reactflow'
import { useAppStore } from '../../../store/useAppStore'
import { useState } from 'react'

export function ActionNode({ data, id, selected }: NodeProps) {
  const setFlowNodes = useAppStore(s => s.setFlowNodes)
  const flowNodes = useAppStore(s => s.flowNodes)
  const remove = () => setFlowNodes(flowNodes.filter(n => n.id !== id))

  return (
    <div style={{
      border: selected ? '4px solid #f5c518' : '4px solid #2d2d2d',
      boxShadow: '5px 5px 0 #2d2d2d',
      minWidth: 190,
      fontFamily: 'var(--font-pixel)',
      overflow: 'hidden',
      borderRadius: 0,
      background: '#fffef0',
    }}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#2d2d2d', width: 14, height: 14, border: '3px solid #fff', borderRadius: 0 }}
      />

      {/* Header — colored strip */}
      <div style={{
        padding: '9px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        borderBottom: '4px solid #2d2d2d',
        background: '#f5a623',
      }}>
        <span style={{ fontSize: 16 }}>🎮</span>
        <span style={{ fontSize: 10, fontWeight: 'bold', color: '#1a1a1a', flex: 1, lineHeight: 1.4 }}>
          {data.label as string}
        </span>
        <button
          onClick={remove}
          style={{
            background: 'rgba(0,0,0,0.2)',
            border: '2px solid rgba(0,0,0,0.3)',
            cursor: 'pointer',
            fontSize: 10,
            padding: '2px 5px',
            lineHeight: 1,
          }}
        >✕</button>
      </div>

      {/* Action items body */}
      <div style={{ background: '#fffef0', padding: '8px 10px' }}>
        <ActionItems nodeId={id} items={(data.items as string[]) ?? []} />
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#2d2d2d', width: 14, height: 14, border: '3px solid #fff', borderRadius: 0 }}
      />
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
          display: 'flex',
          alignItems: 'center',
          gap: 5,
          padding: '5px 8px',
          marginBottom: 4,
          background: '#f8f5e0',
          border: '2px solid #2d2d2d',
          boxShadow: '2px 2px 0 #2d2d2d',
        }}>
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 7, flex: 1, lineHeight: 2, color: '#1a1a1a' }}>
            {item}
          </span>
          <button
            onClick={() => removeItem(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0, lineHeight: 1 }}
          >🗑️</button>
        </div>
      ))}

      <div style={{ display: 'flex', gap: 4, marginTop: items.length > 0 ? 5 : 0 }}>
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="Add action..."
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 7,
            border: '2px solid #2d2d2d',
            padding: '4px 6px',
            flex: 1,
            background: '#fffef0',
            outline: 'none',
          }}
        />
        <button
          onClick={addItem}
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 9,
            background: '#22c55e',
            color: '#fff',
            border: '2px solid #2d2d2d',
            cursor: 'pointer',
            padding: '4px 9px',
            lineHeight: 1,
            boxShadow: '2px 2px 0 #2d2d2d',
          }}
        >+</button>
      </div>
    </div>
  )
}
