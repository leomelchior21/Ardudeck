import { useState } from 'react'
import type { CircuitComponent } from '../../types/database'
import { getComponentDef } from '../../data/components'
import { useAppStore } from '../../store/useAppStore'
import { getPinColor } from '../../logic/pinEngine'

interface Props {
  component: CircuitComponent
  hasConflict: boolean
}

export function ComponentCard({ component, hasConflict }: Props) {
  const [expanded, setExpanded] = useState(false)
  const removeComponent = useAppStore(s => s.removeComponent)
  const def = getComponentDef(component.type)

  const signalPins = component.pins.filter(p => p.type !== 'power' && p.type !== 'gnd')
  const warnings = component.warnings.filter(w => !w.startsWith('Use ') && !w.startsWith('⚠'))
  const notes = component.warnings.filter(w => w.startsWith('Use ') || w.startsWith('⚠'))

  const cardBg = def?.category === 'actuator' ? '#fff8e7' : '#e8f4ff'
  const headerBg = def?.category === 'actuator' ? '#f5a623' : '#4a9eff'

  return (
    <div
      style={{
        border: hasConflict ? '3px solid #ef4444' : '3px solid #2d2d2d',
        boxShadow: hasConflict
          ? '3px 3px 0 #ef4444'
          : '3px 3px 0 #2d2d2d',
        background: cardBg,
        overflow: 'hidden',
      }}
    >
      {/* Header row */}
      <div
        style={{
          background: headerBg,
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          cursor: 'pointer',
        }}
        onClick={() => setExpanded(!expanded)}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>{def?.icon ?? '🔌'}</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 9,
              fontWeight: 'bold',
              color: def?.category === 'actuator' ? '#1a1a1a' : '#fff',
            }}
          >
            {component.name}
          </div>
          {/* Pin badges */}
          <div style={{ display: 'flex', gap: 4, marginTop: 4, flexWrap: 'wrap' }}>
            {signalPins.map(pin => (
              <span
                key={pin.label}
                className="pixel-badge"
                style={{
                  background: getPinColor(pin, hasConflict),
                  color: '#fff',
                  fontSize: 7,
                }}
              >
                {pin.type === 'pwm' ? '~' : ''}{pin.pin}
              </span>
            ))}
          </div>
        </div>

        {/* PWM badge */}
        {signalPins.some(p => p.type === 'pwm') && (
          <span
            className="pixel-badge"
            style={{ background: '#a855f7', color: '#fff', fontSize: 7 }}
          >
            ~PWM
          </span>
        )}

        {/* Delete */}
        <button
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 14,
            padding: 2,
            marginLeft: 4,
          }}
          onClick={e => { e.stopPropagation(); removeComponent(component.id) }}
          title="Remove component"
        >
          🗑️
        </button>
      </div>

      {/* Expanded details */}
      {expanded && (
        <div
          style={{
            padding: '10px 12px',
            borderTop: '2px solid #2d2d2d',
          }}
        >
          {/* Pin table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 8 }}>
            <tbody>
              {component.pins.map(pin => (
                <tr key={pin.label}>
                  <td
                    style={{
                      fontFamily: 'var(--font-pixel)',
                      fontSize: 7,
                      color: '#666',
                      padding: '3px 0',
                      width: '40%',
                    }}
                  >
                    {pin.label}:
                  </td>
                  <td>
                    <span
                      className="pixel-badge"
                      style={{
                        background: getPinColor(pin, hasConflict && pin.type !== 'power' && pin.type !== 'gnd'),
                        color: '#fff',
                        fontSize: 7,
                      }}
                    >
                      {pin.type === 'pwm' ? '~' : ''}{pin.pin}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Power note */}
          {def?.power && (
            <div
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 7,
                color: '#f97316',
                lineHeight: 1.8,
                marginBottom: 4,
              }}
            >
              ⚡ {def.power}
            </div>
          )}

          {/* Notes */}
          {notes.map((note, i) => (
            <div
              key={i}
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 7,
                color: note.startsWith('⚠') ? '#ef4444' : '#555',
                lineHeight: 1.8,
              }}
            >
              {note}
            </div>
          ))}

          {/* Warnings */}
          {warnings.map((w, i) => (
            <div
              key={i}
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 7,
                color: '#eab308',
                lineHeight: 1.8,
              }}
            >
              ⚠ {w}
            </div>
          ))}
        </div>
      )}

      {/* Notes preview (collapsed) */}
      {!expanded && notes.length > 0 && (
        <div
          style={{
            padding: '4px 10px',
            borderTop: '1px solid rgba(0,0,0,0.1)',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 7,
              color: '#666',
            }}
          >
            {notes[0]}
          </span>
        </div>
      )}
    </div>
  )
}
