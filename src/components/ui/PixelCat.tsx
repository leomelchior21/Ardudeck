interface Props { size?: number }

export function PixelCat({ size = 80 }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 80 80"
      style={{ imageRendering: 'pixelated', display: 'inline-block' }}
    >
      {/* Body */}
      <rect x="20" y="30" width="40" height="36" fill="#fde68a" />
      {/* Head */}
      <rect x="18" y="12" width="44" height="32" fill="#fde68a" />
      {/* Ears */}
      <rect x="18" y="6" width="12" height="14" fill="#fde68a" />
      <rect x="50" y="6" width="12" height="14" fill="#fde68a" />
      {/* Inner ears */}
      <rect x="21" y="8" width="7" height="10" fill="#fca5a5" />
      <rect x="52" y="8" width="7" height="10" fill="#fca5a5" />
      {/* Eyes */}
      <rect x="26" y="22" width="8" height="8" fill="#1a1a1a" />
      <rect x="46" y="22" width="8" height="8" fill="#1a1a1a" />
      {/* Eye shine */}
      <rect x="28" y="23" width="3" height="3" fill="#fff" />
      <rect x="48" y="23" width="3" height="3" fill="#fff" />
      {/* Nose */}
      <rect x="36" y="32" width="8" height="5" fill="#fca5a5" />
      {/* Mouth */}
      <rect x="33" y="37" width="4" height="3" fill="#1a1a1a" />
      <rect x="43" y="37" width="4" height="3" fill="#1a1a1a" />
      {/* Whiskers left */}
      <rect x="6" y="34" width="16" height="3" fill="#1a1a1a" />
      <rect x="6" y="40" width="16" height="3" fill="#1a1a1a" />
      {/* Whiskers right */}
      <rect x="58" y="34" width="16" height="3" fill="#1a1a1a" />
      <rect x="58" y="40" width="16" height="3" fill="#1a1a1a" />
      {/* Paws */}
      <rect x="22" y="62" width="14" height="10" fill="#fde68a" />
      <rect x="44" y="62" width="14" height="10" fill="#fde68a" />
      {/* Toe lines */}
      <rect x="25" y="68" width="3" height="4" fill="#fca5a5" />
      <rect x="30" y="68" width="3" height="4" fill="#fca5a5" />
      <rect x="47" y="68" width="3" height="4" fill="#fca5a5" />
      <rect x="52" y="68" width="3" height="4" fill="#fca5a5" />
      {/* Tail */}
      <rect x="60" y="42" width="10" height="8" fill="#fde68a" />
      <rect x="66" y="34" width="8" height="10" fill="#fde68a" />
      <rect x="62" y="30" width="8" height="6" fill="#fde68a" />
      {/* Outline accent */}
      <rect x="18" y="12" width="44" height="2" fill="#d97706" opacity="0.3" />
    </svg>
  )
}
