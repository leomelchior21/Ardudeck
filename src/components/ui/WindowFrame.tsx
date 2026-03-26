import { type ReactNode } from 'react'
import { useAppStore } from '../../store/useAppStore'

interface Props {
  title: string
  topRight?: ReactNode
  children: ReactNode
}

export function WindowFrame({ title, topRight, children }: Props) {
  const student = useAppStore(s => s.student)

  return (
    <div
      style={{
        minHeight: '100vh',
        width: '100%',
        background: '#5cb85c',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
    >
      <div
        style={{
          background: '#f0ead6',
          border: '5px solid #2d2d2d',
          boxShadow: '8px 8px 0 #2d2d2d',
          width: '100%',
          maxWidth: 1260,
          minHeight: '88vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: '#f0ead6',
            borderBottom: '5px solid #2d2d2d',
            padding: '12px 18px',
            display: 'flex',
            alignItems: 'center',
            position: 'relative',
          }}
        >
          {/* Traffic light circles — chunkier, slightly squared */}
          <div style={{ display: 'flex', gap: 9, marginRight: 'auto', zIndex: 1 }}>
            <div style={{
              width: 17, height: 17, borderRadius: 4,
              background: '#ef4444',
              border: '3px solid #c53030',
              boxShadow: '2px 2px 0 #8b1a1a',
            }} />
            <div style={{
              width: 17, height: 17, borderRadius: 4,
              background: '#f5c518',
              border: '3px solid #d69e2e',
              boxShadow: '2px 2px 0 #92620a',
            }} />
            <div style={{
              width: 17, height: 17, borderRadius: 4,
              background: '#22c55e',
              border: '3px solid #16a34a',
              boxShadow: '2px 2px 0 #0a5a26',
            }} />
          </div>

          {/* Centered title */}
          <span
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 13,
              fontWeight: 'bold',
              letterSpacing: 1,
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
              color: '#1a1a1a',
              whiteSpace: 'nowrap',
            }}
          >
            {title}
          </span>

          {/* Right side */}
          <div style={{ marginLeft: 'auto', zIndex: 1 }}>
            {topRight ?? (student && (
              <div
                style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: 9,
                  background: '#f0ead6',
                  border: '4px solid #2d2d2d',
                  padding: '6px 12px',
                  boxShadow: '4px 4px 0 #2d2d2d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 7,
                }}
              >
                <span>🔌</span> {student.ra}
              </div>
            ))}
          </div>
        </div>

        {/* Content */}
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          {children}
        </div>

        {/* Bottom status bar */}
        <div
          style={{
            borderTop: '5px solid #2d2d2d',
            padding: '9px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            background: '#ddd8c0',
          }}
        >
          <span style={{ fontSize: 18 }}>📋</span>
          <div style={{ width: 3, height: 22, background: '#2d2d2d' }} />
          <span style={{ fontSize: 18 }}>📝</span>
          <span style={{ fontSize: 18 }}>⚙️</span>
          <span style={{ fontSize: 18 }}>➕</span>
          <span style={{ fontSize: 18 }}>🔧</span>
        </div>
      </div>
    </div>
  )
}
