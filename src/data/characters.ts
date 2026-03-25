// Pixel character sprites encoded as CSS classes / descriptions
// Using a 5x9 grid of characters from the reference image
export interface CharacterDef {
  id: number
  name: string
  color: string
}

// 45 characters arranged in a 5x9 grid
export const CHARACTERS: CharacterDef[] = [
  { id: 0,  name: 'Chick',      color: '#f5c518' },
  { id: 1,  name: 'Mouse',      color: '#9ca3af' },
  { id: 2,  name: 'Cat',        color: '#fde68a' },
  { id: 3,  name: 'Shadow',     color: '#374151' },
  { id: 4,  name: 'Burger',     color: '#f97316' },
  { id: 5,  name: 'Fat Bird',   color: '#f59e0b' },
  { id: 6,  name: 'Dino',       color: '#22c55e' },
  { id: 7,  name: 'Fluffy',     color: '#e9d5ff' },
  { id: 8,  name: 'Mushroom',   color: '#ef4444' },
  { id: 9,  name: 'Bunny',      color: '#fce7f3' },
  { id: 10, name: 'Owl',        color: '#78350f' },
  { id: 11, name: 'Cow',        color: '#f9fafb' },
  { id: 12, name: 'Ghost',      color: '#e5e7eb' },
  { id: 13, name: 'Snowman',    color: '#bfdbfe' },
  { id: 14, name: 'Guy',        color: '#fdba74' },
  { id: 15, name: 'Bird',       color: '#fbbf24' },
  { id: 16, name: 'Dog',        color: '#d97706' },
  { id: 17, name: 'Sloth',      color: '#a3e635' },
  { id: 18, name: 'Penguin',    color: '#1e293b' },
  { id: 19, name: 'Person',     color: '#fde68a' },
  { id: 20, name: 'Bat',        color: '#7c3aed' },
  { id: 21, name: 'Deer',       color: '#b45309' },
  { id: 22, name: 'Pig',        color: '#fda4af' },
  { id: 23, name: 'Camel',      color: '#d97706' },
  { id: 24, name: 'Monster',    color: '#4ade80' },
  { id: 25, name: 'Panda',      color: '#f1f5f9' },
  { id: 26, name: 'Seal',       color: '#94a3b8' },
  { id: 27, name: 'Hamster',    color: '#fbbf24' },
  { id: 28, name: 'Toaster',    color: '#e2e8f0' },
  { id: 29, name: 'Cat 2',      color: '#fef3c7' },
  { id: 30, name: 'Rooster',    color: '#fca5a5' },
  { id: 31, name: 'Frog',       color: '#bbf7d0' },
  { id: 32, name: 'Knight',     color: '#94a3b8' },
  { id: 33, name: 'Gorilla',    color: '#374151' },
  { id: 34, name: 'Robot',      color: '#6ee7b7' },
  { id: 35, name: 'Mickey',     color: '#1c1917' },
  { id: 36, name: 'Dino 2',     color: '#4ade80' },
  { id: 37, name: 'Mech',       color: '#bae6fd' },
  { id: 38, name: 'Duck',       color: '#fde68a' },
  { id: 39, name: 'Hippo',      color: '#d1d5db' },
  { id: 40, name: 'Bot A',      color: '#a5b4fc' },
  { id: 41, name: 'Bot B',      color: '#6ee7b7' },
  { id: 42, name: 'Unicorn',    color: '#f9a8d4' },
  { id: 43, name: 'Seal 2',     color: '#94a3b8' },
  { id: 44, name: 'Eye Bot',    color: '#fbbf24' },
]

// SVG pixel art for each character (simplified geometric shapes)
// Each character is rendered as a small pixel-art SVG
export function getCharacterEmoji(id: number): string {
  const emojis = [
    '🐥','🐭','🐱','👤','🍔',
    '🐦','🦕','🐑','🍄','🐰',
    '🦉','🐄','👻','⛄','👦',
    '🐤','🐕','🦥','🐧','🚶',
    '🦇','🦌','🐷','🐪','👾',
    '🐼','🦭','🐹','📦','🐈',
    '🐓','🐸','⚔️','🦍','🤖',
    '🐭','🦖','🤺','🦆','🦛',
    '🤖','🤖','🦄','🦭','👁️',
  ]
  return emojis[id] || '❓'
}
