import { useState, useRef, useEffect } from 'react'
import { loginWithRA } from '../../lib/supabase'
import { useAppStore } from '../../store/useAppStore'
import { PixelCat } from '../ui/PixelCat'

export function LoginScreen() {
  const [ra, setRa] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [shake, setShake] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const setStudent = useAppStore(s => s.setStudent)
  const setActiveScreen = useAppStore(s => s.setActiveScreen)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const handleLogin = async () => {
    if (!ra.trim()) {
      triggerError('Please enter your RA number.')
      return
    }
    setLoading(true)
    setError('')
    const { student, error: err } = await loginWithRA(ra)
    setLoading(false)

    if (err || !student) {
      triggerError(err || 'RA not found.')
      return
    }

    setStudent(student)
    setActiveScreen('dashboard')
  }

  const triggerError = (msg: string) => {
    setError(msg)
    setShake(true)
    setTimeout(() => setShake(false), 400)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin()
  }

  return (
    <div
      className="min-h-screen w-full flex items-center justify-center"
      style={{ background: '#5cb85c' }}
    >
      {/* Window frame */}
      <div
        style={{
          background: '#f0ead6',
          border: '4px solid #2d2d2d',
          boxShadow: '6px 6px 0 #2d2d2d',
          width: 420,
          maxWidth: '95vw',
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
            gap: 10,
          }}
        >
          <span style={{ fontSize: 18 }}>🔴</span>
          <span style={{ fontSize: 18 }}>🟡</span>
          <span style={{ fontSize: 18 }}>🟢</span>
        </div>

        {/* Content */}
        <div style={{ padding: '32px 36px', textAlign: 'center' }}>
          {/* Logo */}
          <div
            style={{
              background: '#1a1a1a',
              display: 'inline-block',
              padding: '12px 24px',
              marginBottom: 24,
              border: '3px solid #2d2d2d',
              boxShadow: '4px 4px 0 #2d2d2d',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 22,
                color: '#f5c518',
                letterSpacing: 2,
                display: 'block',
                lineHeight: 1,
              }}
            >
              ARDUDECK
            </span>
          </div>

          {/* Mascot */}
          <div style={{ marginBottom: 20 }}>
            <PixelCat size={96} />
          </div>

          {/* Welcome text */}
          <div
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 12,
              fontWeight: 'bold',
              marginBottom: 8,
            }}
          >
            Welcome to ARDUDECK!
          </div>
          <div
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 9,
              color: '#555',
              marginBottom: 24,
              lineHeight: 1.8,
            }}
          >
            Enter your RA to access your student circuits:
          </div>

          {/* Input row */}
          <div
            className={shake ? 'pixel-shake' : ''}
            style={{ display: 'flex', gap: 0, marginBottom: 12 }}
          >
            {/* Icon cell */}
            <div
              style={{
                background: '#f5c518',
                border: '3px solid #2d2d2d',
                borderRight: 'none',
                width: 44,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 18,
                boxShadow: 'inset 2px 2px 0 rgba(0,0,0,0.15)',
              }}
            >
              🔑
            </div>

            <input
              ref={inputRef}
              className="pixel-input"
              style={{
                flex: 1,
                border: '3px solid #2d2d2d',
                borderRight: 'none',
                fontSize: 11,
              }}
              placeholder="Enter your RA..."
              value={ra}
              onChange={e => setRa(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              maxLength={20}
            />

            <button
              className="pixel-btn pixel-btn-yellow"
              style={{
                border: '3px solid #2d2d2d',
                borderRadius: 0,
                fontSize: 10,
                padding: '0 16px',
                whiteSpace: 'nowrap',
                boxShadow: 'none',
              }}
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <span className="pixel-blink">···</span>
              ) : (
                <>Login ▶</>
              )}
            </button>
          </div>

          {/* Error */}
          {error && (
            <div
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 8,
                color: '#ef4444',
                background: '#fef2f2',
                border: '2px solid #ef4444',
                padding: '6px 10px',
                marginBottom: 10,
                lineHeight: 1.8,
              }}
            >
              ⚠ {error}
            </div>
          )}

          {/* Forgot */}
          <button
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 8,
              color: '#f97316',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              margin: '0 auto',
              marginTop: 4,
            }}
            onClick={() => alert('Please ask your teacher for your RA number.')}
          >
            🗑 Forgot your RA?
          </button>
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
          <span style={{ width: 1, height: 20, background: '#2d2d2d', display: 'inline-block' }} />
          <span style={{ fontSize: 16 }}>📝</span>
          <span style={{ fontSize: 16 }}>⚙️</span>
          <span style={{ fontSize: 16 }}>➕</span>
          <span style={{ fontSize: 16 }}>🔧</span>
        </div>
      </div>
    </div>
  )
}
