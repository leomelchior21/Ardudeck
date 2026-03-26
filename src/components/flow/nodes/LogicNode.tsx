import { Handle, Position, type NodeProps } from 'reactflow'
import { useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'

export function LogicNode({ data, id, selected }: NodeProps) {
  const flowNodes = useAppStore(s => s.flowNodes)
  const setFlowNodes = useAppStore(s => s.setFlowNodes)
  const [logicType, setLogicType] = useState((data.logicType as string) || 'AND')
  const remove = () => setFlowNodes(flowNodes.filter(n => n.id !== id))

  const toggle = () => {
    const next = logicType === 'AND' ? 'OR' : 'AND'
    setLogicType(next)
    setFlowNodes(flowNodes.map(n =>
      n.id === id ? { ...n, data: { ...n.data, logicType: next, label: next } } : n
    ))
  }

  const isAnd = logicType === 'AND'

  return (
    <div style={{
      background: isAnd ? '#f97316' : '#eab308',
      border: selected ? '4px solid #f5c518' : '4px solid #2d2d2d',
      boxShadow: '5px 5px 0 #2d2d2d',
      padding: '10px 16px',
      minWidth: 100,
      fontFamily: 'var(--font-pixel)',
      textAlign: 'center',
      borderRadius: 0,
    }}>
      <Handle
        type="target"
        position={Position.Top}
        id="in1"
        style={{ background: '#2d2d2d', width: 14, height: 14, border: '3px solid #fff', left: '30%', borderRadius: 0 }}
      />
      <Handle
        type="target"
        position={Position.Top}
        id="in2"
        style={{ background: '#2d2d2d', width: 14, height: 14, border: '3px solid #fff', left: '70%', borderRadius: 0 }}
      />

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
        <div style={{
          width: 14, height: 14,
          borderRadius: '50%',
          background: '#fff',
          border: '3px solid #2d2d2d',
          flexShrink: 0,
        }} />
        <button
          onClick={toggle}
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 14,
            fontWeight: 'bold',
            color: isAnd ? '#fff' : '#1a1a1a',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 0,
            lineHeight: 1,
          }}
        >
          {logicType}
        </button>
        <button
          onClick={remove}
          style={{
            background: 'rgba(0,0,0,0.2)',
            border: '2px solid rgba(0,0,0,0.3)',
            cursor: 'pointer',
            fontSize: 10,
            color: isAnd ? '#fff' : '#1a1a1a',
            padding: '2px 5px',
            lineHeight: 1,
          }}
        >✕</button>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        style={{ background: '#2d2d2d', width: 14, height: 14, border: '3px solid #fff', borderRadius: 0 }}
      />
    </div>
  )
}
