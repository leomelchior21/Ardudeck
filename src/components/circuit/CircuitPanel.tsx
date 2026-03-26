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
  const [dropdownTab, setDropdownTab] = useState<'actuators' | 'sensors'>('actuators')
  const [activeListTab, setActiveListTab] = useState<'actuators' | 'sensors'>('actuators')

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
  const visibleComponents = activeListTab === 'actuators' ? actuators : sensors

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        background: '#f0ead6',
      }}
    >
      {/* Top bar — globe + Add Component */}
      <div
        style={{
          padding: '12px 14px',
          borderBottom: '4px solid #2d2d2d',
          background: '#e8e4d0',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 20 }}>🌐</span>

        <div style={{ position: 'relative', flex: 1 }}>
          <button
            className="pixel-btn pixel-btn-yellow"
            style={{ fontSize: 9, width: '100%', justifyContent: 'center' }}
            onClick={() => setShowDropdown(!showDropdown)}
          >
            ➕ Add Component ▼
          </button>

          {showDropdown && (
            <>
              <div
                style={{ position: 'fixed', inset: 0, zIndex: 10 }}
                onClick={() => setShowDropdown(false)}
              />
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  right: 0,
                  marginTop: 4,
                  background: '#f0ead6',
                  border: '4px solid #2d2d2d',
                  boxShadow: '5px 5px 0 #2d2d2d',
                  zIndex: 20,
                  maxHeight: 380,
                  overflowY: 'auto',
                }}
              >
                {/* Dropdown tabs */}
                <div style={{ display: 'flex', borderBottom: '4px solid #2d2d2d', flexShrink: 0 }}>
                  <DropdownTabBtn
                    active={dropdownTab === 'actuators'}
                    color="#f5a623"
                    onClick={() => setDropdownTab('actuators')}
                  >
                    Actuators
                  </DropdownTabBtn>
                  <DropdownTabBtn
                    active={dropdownTab === 'sensors'}
                    color="#4a9eff"
                    onClick={() => setDropdownTab('sensors')}
                  >
                    Sensors
                  </DropdownTabBtn>
                </div>

                {(dropdownTab === 'actuators' ? ACTUATORS : SENSORS).map(def => (
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
                      borderBottom: '2px solid #ddd8c0',
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontFamily: 'var(--font-pixel)',
                      fontSize: 8,
                      color: '#2d2d2d',
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

      {/* Prominent category tabs */}
      <div style={{ display: 'flex', borderBottom: '4px solid #2d2d2d', flexShrink: 0 }}>
        <button
          onClick={() => setActiveListTab('actuators')}
          style={{
            flex: 1,
            padding: '13px 8px',
            background: activeListTab === 'actuators' ? '#f5a623' : '#ddd8c0',
            border: 'none',
            borderRight: '4px solid #2d2d2d',
            fontFamily: 'var(--font-pixel)',
            fontSize: 10,
            fontWeight: 'bold',
            color: activeListTab === 'actuators' ? '#1a1a1a' : '#777',
            cursor: 'pointer',
            letterSpacing: 0.5,
            boxShadow: activeListTab === 'actuators' ? 'inset 0 -3px 0 rgba(0,0,0,0.2)' : 'none',
          }}
        >
          Actuators
        </button>
        <button
          onClick={() => setActiveListTab('sensors')}
          style={{
            flex: 1,
            padding: '13px 8px',
            background: activeListTab === 'sensors' ? '#4a9eff' : '#ddd8c0',
            border: 'none',
            fontFamily: 'var(--font-pixel)',
            fontSize: 10,
            fontWeight: 'bold',
            color: activeListTab === 'sensors' ? '#fff' : '#777',
            cursor: 'pointer',
            letterSpacing: 0.5,
            boxShadow: activeListTab === 'sensors' ? 'inset 0 -3px 0 rgba(0,0,0,0.2)' : 'none',
          }}
        >
          Sensors
        </button>
      </div>

      {/* Component list */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: 12,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {visibleComponents.length === 0 ? (
          <div
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 8,
              color: '#888',
              textAlign: 'center',
              marginTop: 40,
              lineHeight: 2.8,
            }}
          >
            No {activeListTab} yet.
            <br />
            Click "Add Component"
            <br />
            to get started!
          </div>
        ) : (
          visibleComponents.map(comp => (
            <ComponentCard
              key={comp.id}
              component={comp}
              hasConflict={conflictedCompIds.has(comp.id)}
            />
          ))
        )}

        {/* Pin conflict summary */}
        {pinConflicts.size > 0 && (
          <div
            style={{
              marginTop: 8,
              padding: '10px 12px',
              background: '#fef2f2',
              border: '4px solid #ef4444',
              boxShadow: '4px 4px 0 #ef4444',
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

function DropdownTabBtn({
  active,
  color,
  onClick,
  children,
}: {
  active: boolean
  color: string
  onClick: () => void
  children: string
}) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1,
        fontFamily: 'var(--font-pixel)',
        fontSize: 8,
        padding: '10px 4px',
        background: active ? color : '#e8e4d0',
        border: 'none',
        borderRight: '3px solid #2d2d2d',
        cursor: 'pointer',
        color: active ? (color === '#f5a623' ? '#1a1a1a' : '#fff') : '#666',
        fontWeight: active ? 'bold' : 'normal',
      }}
    >
      {children}
    </button>
  )
}
