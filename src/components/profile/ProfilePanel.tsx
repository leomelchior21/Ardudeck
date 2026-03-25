import type { Student } from '../../types/database'
import { CHARACTERS } from '../../data/characters'
import { PixelAvatar } from './PixelAvatar'

interface Props {
  student: Student
  onEditCharacter: () => void
}

export function ProfilePanel({ student, onEditCharacter }: Props) {
  const char = CHARACTERS[student.character_id] ?? CHARACTERS[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      {/* Avatar card */}
      <div
        style={{
          width: '100%',
          maxWidth: 260,
          border: '4px solid #2d2d2d',
          boxShadow: '4px 4px 0 #2d2d2d',
          overflow: 'hidden',
          cursor: 'pointer',
        }}
        onClick={onEditCharacter}
        title="Click to change character"
      >
        {/* Avatar area */}
        <div
          style={{
            background: char.color,
            height: 160,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderBottom: '4px solid #2d2d2d',
            position: 'relative',
          }}
        >
          <PixelAvatar characterId={student.character_id} size={120} />
          <div
            style={{
              position: 'absolute',
              bottom: 6,
              right: 8,
              fontFamily: 'var(--font-pixel)',
              fontSize: 7,
              background: '#1a1a1a',
              color: '#f5c518',
              padding: '2px 6px',
              border: '2px solid #f5c518',
            }}
          >
            EDIT
          </div>
        </div>
        {/* Name */}
        <div
          style={{
            background: '#fff',
            padding: '10px 16px',
            textAlign: 'center',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 10,
              fontWeight: 'bold',
            }}
          >
            {student.full_name.split(' ').slice(0, 2).join(' ')}
          </span>
        </div>
      </div>

      {/* Info rows */}
      <div
        style={{
          width: '100%',
          maxWidth: 260,
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        <InfoRow label="Full Name" value={student.full_name} />
        <InfoRow label="RA" value={student.ra} />
        <InfoRow label="Grade" value={student.grade} />
        <InfoRow label="Group" value={student.group_name} />
      </div>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        fontFamily: 'var(--font-pixel)',
        fontSize: 9,
        lineHeight: 1.8,
      }}
    >
      <span style={{ color: '#666' }}>{label}: </span>
      <span style={{ fontWeight: 'bold' }}>{value}</span>
    </div>
  )
}
