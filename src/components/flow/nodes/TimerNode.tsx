import { Handle, Position, type NodeProps } from 'reactflow'
import { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'

export function TimerNode({ data, id, selected }: NodeProps) {
  const flowNodes = useAppStore(s => s.flowNodes)
  const setFlowNodes = useAppStore(s => s.setFlowNodes)
  const [duration, setDuration] = useState((data.duration as string) || '1')
  const [unit, setUnit] = useState((data.unit as string) || 's')
  const remove = () => setFlowNodes(flowNodes.filter(n => n.id !== id))

  const update = (d: string, u: string) =>
    setFlowNodes(flowNodes.map(n => n.id === id ? { ...n, data: { ...n.data, duration: d, unit: u } } : n))

  return (
    <div style={{
      background: '#06b6d4',
      border: selected ? '4px solid #f5c518' : '4px solid #2d2d2d',
      boxShadow: '5px 5px 0 #2d2d2d',
      minWidth: 160,
      fontFamily: 'var(--font-pixel)',
      borderRadius: 0,
      overflow: 'hidden',
    }}>
      <Handle
        type="target"
        position={Position.Top}
        style={{ background: '#2d2d2d', width: 14, height: 14, border: '3px solid #fff', borderRadius: 0 }}
      />

      <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
        {/* Radio dot */}
        <div style={{
          width: 14, height: 14,
          borderRadius: '50%',
          background: '#fff',
          border: '3px solid #2d2d2d',
          flexShrink: 0,
        }} />

        <span style={{ fontSize: 10, color: '#fff', fontWeight: 'bold', flexShrink: 0 }}>Wait</span>

        <input
          type="number"
          value={duration}
          onChange={e => { setDuration(e.target.value); update(e.target.value, unit) }}
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 9,
            width: 46,
            border: '2px solid #2d2d2d',
            padding: '3px 4px',
            background: '#fffef0',
            outline: 'none',
            textAlign: 'center',
          }}
          min="0.1"
          step="0.5"
        />
        <select
          value={unit}
          onChange={e => { setUnit(e.target.value); update(duration, e.target.value) }}
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 8,
            border: '2px solid #2d2d2d',
            background: '#fffef0',
            padding: '3px 4px',
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          <option value="ms">ms</option>
          <option value="s">s</option>
        </select>

        <button
          onClick={remove}
          style={{
            background: 'rgba(0,0,0,0.25)',
            border: '2px solid rgba(0,0,0,0.35)',
            cursor: 'pointer',
            fontSize: 12,
            color: '#fff',
            padding: '2px 5px',
            lineHeight: 1,
            marginLeft: 'auto',
          }}
        >🗑️</button>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#2d2d2d', width: 14, height: 14, border: '3px solid #fff', borderRadius: 0 }}
      />
    </div>
  )
}
