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
          border: '4px solid #2d2d2d',
          boxShadow: '6px 6px 0 #2d2d2d',
          width: '100%',
          maxWidth: 1200,
          minHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Title bar */}
        <div
          style={{
            background: '#f0ead6',
            borderBottom: '4px solid #2d2d2d',
            padding: '10px 16px',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <div style={{ display: 'flex', gap: 8, marginRight: 'auto' }}>
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#ef4444', border: '2px solid #c53030' }} />
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#f5c518', border: '2px solid #d69e2e' }} />
            <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#22c55e', border: '2px solid #16a34a' }} />
          </div>
          <span
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 12,
              position: 'absolute',
              left: '50%',
              transform: 'translateX(-50%)',
            }}
          >
            {title}
          </span>
          <div style={{ marginLeft: 'auto' }}>
            {topRight ?? (student && (
              <div
                style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: 9,
                  background: '#f0ead6',
                  border: '3px solid #2d2d2d',
                  padding: '5px 10px',
                  boxShadow: '3px 3px 0 #2d2d2d',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
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

        {/* Bottom bar */}
        <div
          style={{
            borderTop: '4px solid #2d2d2d',
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: '#e8e4d0',
          }}
        >
          <span style={{ fontSize: 16 }}>📋</span>
          <div style={{ width: 2, height: 20, background: '#2d2d2d' }} />
          <span style={{ fontSize: 16 }}>📝</span>
          <span style={{ fontSize: 16 }}>⚙️</span>
          <span style={{ fontSize: 16 }}>➕</span>
          <span style={{ fontSize: 16 }}>🔧</span>
        </div>
      </div>
    </div>
  )
}
