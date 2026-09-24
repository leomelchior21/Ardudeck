/**
 * Launcher illustrations. Original SVG art: a generic Arduino-class board
 * (no third-party logo), a wireframe globe and a mountain range.
 */

export function BoardArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 380 300" className={className} fill="none" aria-hidden="true">
      <path
        d="M236 92c60-16 118 14 128 64 10 53-34 104-92 116-60 12-122-15-134-66-12-51 36-98 98-114z"
        fill="var(--violet)"
      />
      <g transform="translate(6 20) rotate(-13 160 122)">
        <rect
          x="42"
          y="42"
          width="236"
          height="160"
          rx="14"
          fill="#0c0f13"
          stroke="#272c33"
          strokeWidth="2"
        />
        <rect x="70" y="20" width="186" height="22" rx="6" fill="#23282f" />
        <rect x="70" y="202" width="186" height="22" rx="6" fill="#23282f" />
        <line
          x1="82"
          y1="31"
          x2="244"
          y2="31"
          stroke="#4b525b"
          strokeWidth="7"
          strokeDasharray="3 7"
        />
        <line
          x1="82"
          y1="213"
          x2="244"
          y2="213"
          stroke="#4b525b"
          strokeWidth="7"
          strokeDasharray="3 7"
        />
        <rect x="10" y="104" width="34" height="38" rx="5" fill="#98a1ab" />
        <rect x="16" y="112" width="22" height="22" rx="3" fill="#6d757f" />
        <rect x="10" y="64" width="26" height="22" rx="4" fill="#3a4046" />
        <rect
          x="126"
          y="96"
          width="70"
          height="52"
          rx="7"
          fill="#2b3037"
          stroke="#454c55"
          strokeWidth="2"
        />
        <circle cx="140" cy="110" r="4" fill="#59616b" />
        <rect x="150" y="106" width="36" height="4" rx="2" fill="#454c55" />
        <rect x="150" y="116" width="26" height="4" rx="2" fill="#454c55" />
        <rect x="86" y="104" width="26" height="14" rx="4" fill="#8e97a1" />
        <circle cx="224" cy="112" r="8" fill="#20252b" stroke="#454c55" strokeWidth="2" />
        <circle cx="224" cy="148" r="8" fill="#20252b" stroke="#454c55" strokeWidth="2" />
        <rect x="96" y="150" width="22" height="12" rx="3" fill="#3a4046" />
        <rect x="214" y="58" width="32" height="18" rx="4" fill="#2b3037" />
        <circle cx="86" cy="66" r="5" fill="var(--lime)" />
        <circle cx="104" cy="66" r="5" fill="var(--coral)" />
        <path
          d="M42 88h30M42 160h30M278 88h-30M278 122h-26M278 160h-30"
          stroke="#3a4046"
          strokeWidth="2"
        />
        <path
          d="M140 174h8l4-9 6 16 5-11h9"
          stroke="var(--lime)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>
    </svg>
  );
}

export function GlobeArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} fill="none" aria-hidden="true">
      <defs>
        <clipPath id="arduos-globe-disc">
          <circle cx="100" cy="100" r="82" />
        </clipPath>
        <clipPath id="arduos-globe-left">
          <path d="M100 18 A82 82 0 0 0 100 182 Z" />
        </clipPath>
      </defs>
      <circle
        cx="100"
        cy="100"
        r="84"
        fill="var(--os-panel-2)"
        stroke="var(--violet)"
        strokeWidth="5"
      />
      <path d="M100 16 A84 84 0 0 0 100 184 Z" fill="var(--violet)" />
      <g clipPath="url(#arduos-globe-disc)" stroke="var(--violet)" strokeWidth="4">
        <path d="M18 100h164" />
        <path d="M29 58h142" />
        <path d="M29 142h142" />
        <ellipse cx="100" cy="100" rx="30" ry="82" />
      </g>
      <g clipPath="url(#arduos-globe-left)" stroke="var(--os-shell)" strokeWidth="4">
        <path d="M18 100h164" />
        <path d="M29 58h142" />
        <path d="M29 142h142" />
        <ellipse cx="100" cy="100" rx="30" ry="82" />
      </g>
    </svg>
  );
}

export function MountainsArt({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 220 150" className={className} fill="none" aria-hidden="true">
      <circle cx="182" cy="30" r="23" fill="var(--lime)" />
      <path d="M2 144 L72 38 L142 144 Z" fill="#8b6ff7" />
      <path d="M104 144 L156 62 L218 144 Z" fill="#5b3fd6" />
    </svg>
  );
}
