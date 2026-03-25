import { useState } from 'react'
import { useAppStore } from '../../store/useAppStore'
import { ACTUATORS, SENSORS } from '../../data/components'
import type { ComponentType } from '../../types/database'
import { ComponentCard } from './ComponentCard'
import { checkPinConflicts } from '../../logic/pinEngine'

export function CircuitPanel() {
  const components = useAppStore(s => s.components)
  const addComponent = useAppStore(s => s.addComponent)
  const [showDropdown, setShowDropdown] = useState(false)
  const [activeTab, setActiveTab] = useState<'actuators' | 'sensors'>('actuators')

  const pinConflicts = checkPinConflicts(components)
  const conflictedCompIds = new Set<string>()
  for (const compIds of pinConflicts.values()) {
    compIds.forEach(id => conflictedCompIds.add(id))
  }

  const handleAdd = (type: ComponentType) => {
    addComponent(type)
    setShowDropdown(false)
  }

  const actuators = components.filter(c => c.category === 'actuator')
  const sensors = components.filter(c => c.category === 'sensor')

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '3px solid #2d2d2d',
          background: '#e8e4d0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        {/* Globe icon */}
        <span style={{ fontSize: 18 }}>🌐</span>

        {/* Add button with dropdown */}
        <div style={{ position: 'relative' }}>
          <button
            className="pixel-btn pixel-btn-yellow"
            style={{ fontSize: 9 }}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            ➕ Add Component ▼
          </button>

          {showDropdown && (
            <>
              {/* Backdrop */}
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                onClick={() => setShowDropdown(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: 4,
                  background: '#f0ead6',
                  border: '3px solid #2d2d2d',
                  boxShadow: '4px 4px 0 #2d2d2d',
                  zIndex: 20,
                  width: 220,
                  maxHeight: 360,
                  overflowY: 'auto',
                }}
              >
                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: '3px solid #2d2d2d' }}>
                  <TabBtn
                    active={activeTab === 'actuators'}
                    onClick={() => setActiveTab('actuators')}
                    color="#f5a623"
                  >
                    Actuators
                  </TabBtn>
                  <TabBtn
                    active={activeTab === 'sensors'}
                    onClick={() => setActiveTab('sensors')}
                    color="#4a9eff"
                  >
                    Sensors
                  </TabBtn>
                </div>

                {/* List */}
                {(activeTab === 'actuators' ? ACTUATORS : SENSORS).map(def => (
                  <button
                    key={def.type}
                    onClick={() => handleAdd(def.type)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      width: '100%',
                      padding: '10px 14px',
                      background: 'none',
                      border: 'none',
                      borderBottom: '1px solid #ddd8c0',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--font-pixel)',
                      fontSize: 8,
                    }}
                    onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.background = '#fffef0')}
                    onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.background = 'none')}
                  >
                    <span style={{ fontSize: 16 }}>{def.icon}</span>
                    {def.name}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Component list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
        }}
      >
        {components.length === 0 ? (
          <div
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 8,
              color: '#888',
              textAlign: 'center',
              marginTop: 40,
              lineHeight: 2.5,
            }}
          >
            No components yet.
            <br />
            Click "Add Component"
            <br />
            to get started!
          </div>
        ) : (
          <>
            {actuators.length > 0 && (
              <>
                <SectionLabel color="#f5a623">Actuators</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 12 }}>
                  {actuators.map(comp => (
                    <ComponentCard
                      key={comp.id}
                      component={comp}
                      hasConflict={conflictedCompIds.has(comp.id)}
                    />
                  ))}
                </div>
              </>
            )}

            {sensors.length > 0 && (
              <>
                <div className="dotted-sep" />
                <SectionLabel color="#4a9eff">Sensors</SectionLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sensors.map(comp => (
                    <ComponentCard
                      key={comp.id}
                      component={comp}
                      hasConflict={conflictedCompIds.has(comp.id)}
                    />
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* Pin conflict summary */}
        {pinConflicts.size > 0 && (
          <div
            style={{
              marginTop: 16,
              padding: '10px 12px',
              background: '#fef2f2',
              border: '3px solid #ef4444',
              boxShadow: '3px 3px 0 #ef4444',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 8,
                color: '#ef4444',
                marginBottom: 6,
              }}
            >
              ⚠ Pin Conflicts:
            </div>
            {[...pinConflicts.entries()].map(([pin, compIds]) => (
              <div
                key={pin}
                style={{ fontFamily: 'var(--font-pixel)', fontSize: 7, color: '#dc2626', lineHeight: 2 }}
              >
                {pin} used by {compIds.length} components
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function SectionLabel({ children, color }: { children: string; color: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-pixel)',
        fontSize: 9,
        fontWeight: 'bold',
        color: '#fff',
        background: color,
        border: '2px solid #2d2d2d',
        padding: '4px 8px',
        marginBottom: 8,
        display: 'inline-block',
        boxShadow: '2px 2px 0 #2d2d2d',
      }}
    >
      {children}
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  color,
  children,
}: {
  active: boolean
  onClick: () => void
  color: string
  children: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        fontFamily: 'var(--font-pixel)',
        fontSize: 8,
        padding: '8px 4px',
        background: active ? color : '#e8e4d0',
        border: 'none',
        borderRight: '2px solid #2d2d2d',
        cursor: 'pointer',
        color: active ? '#fff' : '#555',
        fontWeight: active ? 'bold' : 'normal',
      }}
    >
      {children}
    </button>
  )
}
