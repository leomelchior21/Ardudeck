import type { CircuitComponent, ComponentType } from '../../types/database'
import { getComponentDef } from '../../data/components'
import { useAppStore } from '../../store/useAppStore'
import { getPinColor } from '../../logic/pinEngine'

interface Props {
  component: CircuitComponent
  hasConflict: boolean
}

// Per-component distinct colors matching inspiration
const COMP_COLORS: Record<ComponentType, { bg: string; text: string }> = {
  led:             { bg: '#f5c518', text: '#1a1a1a' },
  rgb_led:         { bg: '#c084fc', text: '#fff' },
  servo_180:       { bg: '#f97316', text: '#fff' },
  servo_360:       { bg: '#ea580c', text: '#fff' },
  buzzer:          { bg: '#ef4444', text: '#fff' },
  relay:           { bg: '#22c55e', text: '#fff' },
  stepper:         { bg: '#3b82f6', text: '#fff' },
  solenoid:        { bg: '#6366f1', text: '#fff' },
  potentiometer:   { bg: '#84cc16', text: '#1a1a1a' },
  button:          { bg: '#4a9eff', text: '#fff' },
  ldr:             { bg: '#fbbf24', text: '#1a1a1a' },
  ultrasonic:      { bg: '#06b6d4', text: '#fff' },
  temperature:     { bg: '#f87171', text: '#fff' },
  humidity:        { bg: '#38bdf8', text: '#1a1a1a' },
  water_turbidity: { bg: '#0284c7', text: '#fff' },
  water_level:     { bg: '#0ea5e9', text: '#fff' },
  rain_sensor:     { bg: '#818cf8', text: '#fff' },
  soil_humidity:   { bg: '#86efac', text: '#1a1a1a' },
}

export function ComponentCard({ component, hasConflict }: Props) {
  const removeComponent = useAppStore(s => s.removeComponent)
  const def = getComponentDef(component.type)

  const color = COMP_COLORS[component.type] ?? { bg: '#9ca3af', text: '#fff' }
  const signalPins = component.pins.filter(p => p.type !== 'power' && p.type !== 'gnd')
  const hasPWM = signalPins.some(p => p.type === 'pwm')
  const notes = component.warnings.filter(w => w.startsWith('Use ') || w.startsWith('⚠'))
  const powerNote = def?.power

  return (
    <div
      style={{
        border: hasConflict ? '3px solid #ef4444' : '3px solid #2d2d2d',
        boxShadow: hasConflict ? '3px 3px 0 #ef4444' : '3px 3px 0 #2d2d2d',
        overflow: 'hidden',
        background: '#fffef0',
      }}
    >
      {/* Header — component color */}
      <div
        style={{
          background: color.bg,
          padding: '8px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{def?.icon ?? '🔌'}</span>

        <span
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 9,
            fontWeight: 'bold',
            color: color.text,
            flex: 1,
            lineHeight: 1.4,
          }}
        >
          {component.name}
        </span>

        {/* ~PWM badge */}
        {hasPWM && (
          <span
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 7,
              background: 'rgba(0,0,0,0.25)',
              color: '#fff',
              border: '2px solid rgba(0,0,0,0.3)',
              padding: '2px 5px',
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ~PWM
          </span>
        )}

        {/* Trash */}
        <button
          style={{
            background: 'rgba(0,0,0,0.15)',
            border: '2px solid rgba(0,0,0,0.2)',
            cursor: 'pointer',
            fontSize: 12,
            padding: '2px 4px',
            lineHeight: 1,
            color: color.text,
            flexShrink: 0,
          }}
          onClick={() => removeComponent(component.id)}
          title="Remove"
        >
          🗑️
        </button>
      </div>

      {/* Body — pin info, always visible */}
      <div style={{ padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {signalPins.map(pin => (
          <div key={pin.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 7, color: '#555', minWidth: 48 }}>
              {pin.label}:
            </span>
            <span
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 7,
                background: getPinColor(pin, hasConflict),
                color: '#fff',
                border: '2px solid #2d2d2d',
                padding: '2px 5px',
                lineHeight: 1,
              }}
            >
              {pin.type === 'pwm' ? '~' : ''}{pin.pin}
            </span>
          </div>
        ))}

        {powerNote && (
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 7, color: '#f97316', lineHeight: 1.8, marginTop: 2 }}>
            Power: {powerNote}
          </div>
        )}

        {notes.map((note, i) => (
          <div
            key={i}
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 7,
              color: note.startsWith('⚠') ? '#ef4444' : '#666',
              lineHeight: 1.8,
            }}
          >
            {note}
          </div>
        ))}
      </div>
    </div>
  )
}
