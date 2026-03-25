import { Handle, Position, type NodeProps } from 'reactflow'
import { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'

export function DelayNode({ data, id, selected }: NodeProps) {
  const flowNodes = useAppStore(s => s.flowNodes)
  const setFlowNodes = useAppStore(s => s.setFlowNodes)
  const [duration, setDuration] = useState((data.duration as string) || '0.5')
  const [unit, setUnit] = useState((data.unit as string) || 's')

  const remove = () => setFlowNodes(flowNodes.filter(n => n.id !== id))

  const update = (d: string, u: string) => {
    setFlowNodes(flowNodes.map(n =>
      n.id === id ? { ...n, data: { ...n.data, duration: d, unit: u } } : n
    ))
  }

  return (
    <div
      style={{
        background: '#a855f7',
        border: selected ? '4px solid #f5c518' : '4px solid #2d2d2d',
        boxShadow: '4px 4px 0 #2d2d2d',
        padding: '8px 12px',
        minWidth: 130,
        fontFamily: 'var(--font-pixel)',
      }}
    >
      <Handle type="target" position={Position.Top}
        style={{ background: '#2d2d2d', width: 10, height: 10, border: '2px solid #fff' }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#fff', border: '2px solid #2d2d2d', flexShrink: 0 }} />
        <span style={{ fontSize: 9, color: '#fff', flex: 1 }}>Wait</span>
        <button onClick={remove} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 12, color: '#fff', padding: 0 }}>✕</button>
      </div>

      <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
        <input
          type="number"
          value={duration}
          onChange={e => { setDuration(e.target.value); update(e.target.value, unit) }}
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 9,
            width: 50,
            border: '2px solid #2d2d2d',
            padding: '3px 5px',
            background: '#fffef0',
            outline: 'none',
          }}
          min="0.1"
          step="0.1"
        />
        <select
          value={unit}
          onChange={e => { setUnit(e.target.value); update(duration, e.target.value) }}
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 8,
            border: '2px solid #2d2d2d',
            background: '#fffef0',
            padding: '3px',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="ms">ms</option>
          <option value="s">s</option>
        </select>
      </div>

      <Handle type="source" position={Position.Bottom}
        style={{ background: '#2d2d2d', width: 10, height: 10, border: '2px solid #fff' }} />
    </div>
  )
}
