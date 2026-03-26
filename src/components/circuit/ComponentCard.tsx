import type { CircuitComponent, ComponentType } from '../../types/database'
import { getComponentDef } from '../../data/components'
import { useAppStore } from '../../store/useAppStore'
import { getPinColor } from '../../logic/pinEngine'

interface Props {
  component: CircuitComponent
  hasConflict: boolean
}

// Per-component distinct colors — full card fill
const COMP_COLORS: Record<ComponentType, { bg: string; text: string; bodyBg: string }> = {
  led:             { bg: '#f5c518', text: '#1a1a1a', bodyBg: '#ffe566' },
  rgb_led:         { bg: '#c084fc', text: '#fff',    bodyBg: '#d8a8ff' },
  servo_180:       { bg: '#f97316', text: '#fff',    bodyBg: '#ffab6a' },
  servo_360:       { bg: '#ea580c', text: '#fff',    bodyBg: '#ff8c4e' },
  buzzer:          { bg: '#ef4444', text: '#fff',    bodyBg: '#ff7070' },
  relay:           { bg: '#22c55e', text: '#fff',    bodyBg: '#5edc8c' },
  stepper:         { bg: '#3b82f6', text: '#fff',    bodyBg: '#6aa0f8' },
  solenoid:        { bg: '#6366f1', text: '#fff',    bodyBg: '#8b8df7' },
  potentiometer:   { bg: '#84cc16', text: '#1a1a1a', bodyBg: '#b3e64c' },
  button:          { bg: '#4a9eff', text: '#fff',    bodyBg: '#7ab8ff' },
  ldr:             { bg: '#fbbf24', text: '#1a1a1a', bodyBg: '#ffd66e' },
  ultrasonic:      { bg: '#06b6d4', text: '#fff',    bodyBg: '#35d0ec' },
  temperature:     { bg: '#f87171', text: '#fff',    bodyBg: '#ffa0a0' },
  humidity:        { bg: '#38bdf8', text: '#1a1a1a', bodyBg: '#70d4fb' },
  water_turbidity: { bg: '#0284c7', text: '#fff',    bodyBg: '#2da8e8' },
  water_level:     { bg: '#0ea5e9', text: '#fff',    bodyBg: '#3abff8' },
  rain_sensor:     { bg: '#818cf8', text: '#fff',    bodyBg: '#a8b0fb' },
  soil_humidity:   { bg: '#86efac', text: '#1a1a1a', bodyBg: '#b2f5cc' },
}

export function ComponentCard({ component, hasConflict }: Props) {
  const removeComponent = useAppStore(s => s.removeComponent)
  const def = getComponentDef(component.type)

  const color = COMP_COLORS[component.type] ?? { bg: '#9ca3af', text: '#fff', bodyBg: '#b8b2a0' }
  const signalPins = component.pins.filter(p => p.type !== 'power' && p.type !== 'gnd')
  const hasPWM = signalPins.some(p => p.type === 'pwm')
  const notes = component.warnings.filter(w => w.startsWith('Use ') || w.startsWith('⚠'))
  const powerNote = def?.power

  const borderColor = hasConflict ? '#ef4444' : '#2d2d2d'
  const shadowColor = hasConflict ? '#ef4444' : '#2d2d2d'

  return (
    <div
      style={{
        border: `4px solid ${borderColor}`,
        boxShadow: `5px 5px 0 ${shadowColor}`,
        overflow: 'hidden',
        background: color.bg,
      }}
    >
      {/* Header row — icon + name + badges + trash */}
      <div
        style={{
          background: color.bg,
          padding: '10px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: 9,
          borderBottom: `3px solid rgba(0,0,0,0.25)`,
        }}
      >
        {/* Large icon */}
        <span style={{ fontSize: 22, lineHeight: 1, flexShrink: 0 }}>{def?.icon ?? '🔌'}</span>

        {/* Name */}
        <span
          style={{
            fontFamily: 'var(--font-pixel)',
            fontSize: 10,
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
              background: 'rgba(0,0,0,0.4)',
              color: '#fff',
              border: '2px solid rgba(0,0,0,0.5)',
              padding: '3px 6px',
              lineHeight: 1,
              flexShrink: 0,
              letterSpacing: 0.5,
            }}
          >
            ~PWM
          </span>
        )}

        {/* Trash button */}
        <button
          style={{
            background: 'rgba(0,0,0,0.2)',
            border: '2px solid rgba(0,0,0,0.3)',
            cursor: 'pointer',
            fontSize: 13,
            padding: '3px 5px',
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

      {/* Body — pin info on slightly lighter bg */}
      <div
        style={{
          background: color.bodyBg,
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
        }}
      >
        {signalPins.map(pin => (
          <div key={pin.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 7,
                color: color.text,
                opacity: 0.75,
                minWidth: 52,
              }}
            >
              {pin.label}:
            </span>
            <span
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 7,
                background: getPinColor(pin, hasConflict),
                color: '#fff',
                border: '2px solid #2d2d2d',
                padding: '2px 6px',
                lineHeight: 1,
                boxShadow: '2px 2px 0 #2d2d2d',
              }}
            >
              {pin.type === 'pwm' ? '~' : ''}{pin.pin}
            </span>
          </div>
        ))}

        {powerNote && (
          <div
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 7,
              color: color.text,
              opacity: 0.85,
              lineHeight: 1.8,
              marginTop: 2,
            }}
          >
            Power: {powerNote}
          </div>
        )}

        {notes.map((note, i) => (
          <div
            key={i}
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 7,
              color: note.startsWith('⚠') ? '#1a1a1a' : color.text,
              opacity: note.startsWith('⚠') ? 1 : 0.8,
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
