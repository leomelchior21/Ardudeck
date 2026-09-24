import wordmark from '../assets/ardudeck-wordmark.png';

/**
 * Original Ardu OS family marks.
 *
 * Shared motif: connected nodes and a signal path - a physical pulse that
 * travels through a system. Each app bends the motif in its own direction.
 * All marks are stroked SVG so they inherit currentColor and read at 16px.
 */

export interface MarkProps {
  size?: number;
  className?: string;
}

/** The official ArduDeck wordmark. `variant="ink"` makes it dark for light surfaces. */
export function ArduDeckWordmark({
  height = 26,
  variant = 'white',
  className,
}: {
  height?: number;
  variant?: 'white' | 'ink';
  className?: string;
}) {
  return (
    <img
      src={wordmark}
      alt="ArduDeck"
      className={className}
      style={{
        height,
        width: 'auto',
        display: 'block',
        filter: variant === 'ink' ? 'brightness(0) saturate(100%)' : undefined,
      }}
    />
  );
}

/**
 * Ardu OS mark: a violet module capsule rising to the upper-right, with a lime
 * signal wedge tucked under its lower-left end. Drawn in a 64x56 box with room
 * for the rotation so nothing is clipped from 16px up.
 */
const OS_MARK_VIEWBOX = '0 0 64 60';

function osMarkShapes(moduleColor: string, signalColor: string) {
  return (
    <>
      <rect
        x="32"
        y="5"
        width="16"
        height="50"
        rx="8"
        transform="rotate(28 40 30)"
        fill={moduleColor}
      />
      <path
        d="M22 31 L9 48 L31 50 Z"
        fill={signalColor}
        stroke={signalColor}
        strokeWidth="10"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </>
  );
}

/** Ardu OS mark in a single colour (inherits currentColor). */
export function ArduOsMark({ size = 40, className }: MarkProps) {
  return (
    <svg
      viewBox={OS_MARK_VIEWBOX}
      width={size * 1.067}
      height={size}
      className={className}
      fill="none"
      role="img"
      aria-label="Ardu OS"
    >
      {osMarkShapes('currentColor', 'currentColor')}
    </svg>
  );
}

/** The Ardu OS mark in its brand colours: violet module + lime signal. */
export function ArduOsLogo({ size = 40, className }: MarkProps) {
  return (
    <svg
      viewBox={OS_MARK_VIEWBOX}
      width={size * 1.067}
      height={size}
      className={className}
      fill="none"
      role="img"
      aria-label="Ardu OS"
    >
      {osMarkShapes('var(--violet)', 'var(--lime)')}
    </svg>
  );
}

/** ArduDeck: a deck of layers with a signal crossing it. */
export function ArduDeckMark({ size = 40, className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      fill="none"
      role="img"
      aria-label="ArduDeck"
    >
      <rect x="7" y="10" width="34" height="10" rx="5" stroke="currentColor" strokeWidth="3" />
      <rect x="7" y="24" width="34" height="14" rx="6" stroke="currentColor" strokeWidth="3" />
      <path
        d="M14 31h4.5l2.5-4 3 8 2.5-5h4"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** ArduWorld: a world a signal travels around. */
export function ArduWorldMark({ size = 40, className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      fill="none"
      role="img"
      aria-label="ArduWorld"
    >
      <circle cx="24" cy="24" r="17" stroke="currentColor" strokeWidth="3" />
      <ellipse cx="24" cy="24" rx="8" ry="17" stroke="currentColor" strokeWidth="2.4" />
      <path d="M8 24h32" stroke="currentColor" strokeWidth="2.4" />
      <circle cx="38" cy="12" r="3.4" fill="currentColor" />
    </svg>
  );
}

/** ArduQuest: a target found through a path. */
export function ArduQuestMark({ size = 40, className }: MarkProps) {
  return (
    <svg
      viewBox="0 0 48 48"
      width={size}
      height={size}
      className={className}
      fill="none"
      role="img"
      aria-label="ArduQuest"
    >
      <circle cx="27" cy="21" r="13" stroke="currentColor" strokeWidth="3" />
      <circle cx="27" cy="21" r="5" stroke="currentColor" strokeWidth="2.6" />
      <path
        d="M5 43l9-9M12 38l5 1.5 1.5 5"
        stroke="currentColor"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
