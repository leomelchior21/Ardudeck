import { getCharacterEmoji } from '../../data/characters'

interface Props {
  characterId: number
  size?: number
}

// Pixel avatar renderer — each character is a styled emoji with pixel treatment
export function PixelAvatar({ characterId, size = 80 }: Props) {
  const fontSize = size * 0.6

  return (
    <div
      style={{
        width: size,
        height: size,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        imageRendering: 'pixelated',
        fontSize,
        lineHeight: 1,
        filter: 'contrast(1.2)',
        userSelect: 'none',
      }}
    >
      {getCharacterEmoji(characterId)}
    </div>
  )
}
