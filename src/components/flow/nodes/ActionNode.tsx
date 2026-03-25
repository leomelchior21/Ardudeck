import { Handle, Position, type NodeProps } from 'reactflow'
import { useAppStore } from '../../../store/useAppStore'
import { useState } from 'react'

export function ActionNode({ data, id, selected }: NodeProps) {
  const setFlowNodes = useAppStore(s => s.setFlowNodes)
  const flowNodes = useAppStore(s => s.flowNodes)

  const remove = () => setFlowNodes(flowNodes.filter(n => n.id !== id))

  return (
    <div
      style={{
        background: '#f5a623',
        border: selected ? '4px solid #f5c518' : '4px solid #2d2d2d',
        boxShadow: '4px 4px 0 #2d2d2d',
        padding: '8px 12px',
        minWidth: 160,
        fontFamily: 'var(--font-pixel)',
      }}
    >
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#2d2d2d', width: 10, height: 10, border: '2px solid #fff' }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
        <span style={{ fontSize: 14 }}>🎮</span>
        <span style={{ fontSize: 9, fontWeight: 'bold', color: '#1a1a1a', flex: 1 }}>
          {data.label as string}
        </span>
        <button onClick={remove} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, padding: 0 }}>✕</button>
      </div>

      {/* Editable action items */}
      <ActionItems nodeId={id} items={(data.items as string[]) ?? []} />

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#2d2d2d', width: 10, height: 10, border: '2px solid #fff' }}
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
    const updated = [...items, newItem.trim()]
    setFlowNodes(flowNodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, items: updated } } : n))
    setNewItem('')
  }

  const removeItem = (idx: number) => {
    const updated = items.filter((_, i) => i !== idx)
    setFlowNodes(flowNodes.map(n => n.id === nodeId ? { ...n, data: { ...n.data, items: updated } } : n))
  }

  return (
    <div>
      {items.map((item, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 6px',
            marginBottom: 3,
            background: '#fffef0',
            border: '2px solid #2d2d2d',
          }}
        >
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 7, flex: 1, lineHeight: 1.6 }}>{item}</span>
          <button
            onClick={() => removeItem(i)}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 10, padding: 0 }}
          >
            🗑️
          </button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 3, marginTop: 4 }}>
        <input
          value={newItem}
          onChange={e => setNewItem(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && addItem()}
          placeholder="Add action..."
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 7,
            border: '2px solid #2d2d2d',
            padding: '3px 5px',
            flex: 1,
            background: '#fffef0',
            outline: 'none',
          }}
        />
        <button
          onClick={addItem}
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 7,
            background: '#22c55e',
            color: '#fff',
            border: '2px solid #2d2d2d',
            cursor: 'pointer',
            padding: '3px 6px',
          }}
        >
          +
        </button>
      </div>
    </div>
  )
}
