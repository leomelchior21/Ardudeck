import { useState } from 'react'
import { CHARACTERS, getCharacterEmoji } from '../../data/characters'
import { useAppStore } from '../../store/useAppStore'
import { updateCharacter } from '../../lib/supabase'

interface Props {
  onClose: () => void
}

export function CharacterSelector({ onClose }: Props) {
  const student = useAppStore(s => s.student)
  const setStudent = useAppStore(s => s.setStudent)
  const [selected, setSelected] = useState(student?.character_id ?? 0)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    if (!student) return
    setSaving(true)
    await updateCharacter(student.id, selected)
    setStudent({ ...student, character_id: selected })
    setSaving(false)
    onClose()
  }

  const handleRandom = () => {
    setSelected(Math.floor(Math.random() * CHARACTERS.length))
  }

  return (
    <div>
      <div
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 8,
          marginBottom: 16,
          color: '#555',
        }}
      >
        Select your character:
      </div>

      {/* Character grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(9, 1fr)',
          gap: 6,
          marginBottom: 16,
          maxHeight: 340,
          overflowY: 'auto',
          padding: 4,
        }}
      >
        {CHARACTERS.map(char => (
          <button
            key={char.id}
            onClick={() => setSelected(char.id)}
            title={char.name}
            style={{
              width: 56,
              height: 56,
              border: selected === char.id ? '4px solid #f5c518' : '3px solid #2d2d2d',
              background: char.color,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 28,
              boxShadow: selected === char.id
                ? '0 0 0 2px #f5c518, 3px 3px 0 #2d2d2d'
                : '2px 2px 0 #2d2d2d',
              transition: 'transform 0.05s',
              outline: 'none',
              padding: 0,
              transform: selected === char.id ? 'translate(-1px,-1px)' : 'none',
            }}
          >
            {getCharacterEmoji(char.id)}
          </button>
        ))}
      </div>

      {/* Selected preview */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 16,
          marginBottom: 16,
          padding: '10px 14px',
          border: '3px solid #2d2d2d',
          background: '#fffef0',
        }}
      >
        <span style={{ fontSize: 40 }}>{getCharacterEmoji(selected)}</span>
        <div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 10, marginBottom: 4 }}>
            {CHARACTERS[selected]?.name}
          </div>
          <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 8, color: '#888' }}>
            #{selected.toString().padStart(2, '0')}
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        <button className="pixel-btn pixel-btn-green" onClick={handleSave} disabled={saving}>
          {saving ? <span className="pixel-blink">Saving...</span> : '✅ Save Character'}
        </button>
        <button className="pixel-btn pixel-btn-blue" onClick={handleRandom}>
          🎲 Random
        </button>
        <button className="pixel-btn pixel-btn-gray" onClick={onClose}>
          Cancel
        </button>
      </div>
    </div>
  )
}
