import type { ReactNode } from 'react';
import type { IconId } from '@ardudeck/core';

export type IconName =
  | IconId
  | 'back'
  | 'check'
  | 'close'
  | 'warning'
  | 'play'
  | 'stop'
  | 'trash'
  | 'plus'
  | 'refresh'
  | 'code'
  | 'upload'
  | 'chip'
  | 'chevron-up'
  | 'chevron-down'
  | 'folder'
  | 'flask'
  | 'sliders'
  | 'usb'
  | 'layers'
  | 'bolt'
  | 'arrow-right'
  | 'grid'
  | 'globe'
  | 'target'
  | 'sparkles'
  | 'ruler'
  | 'moon'
  | 'plant'
  | 'cloud'
  | 'music'
  | 'box'
  | 'bell'
  | 'radio'
  | 'timer'
  | 'gear'
  | 'search'
  | 'list'
  | 'digital'
  | 'analog'
  | 'pwm'
  | 'ground'
  | 'terminal'
  | 'swap'
  | 'resistor'
  | 'pencil'
  | 'undo'
  | 'redo'
  | 'minimize'
  | 'maximize'
  | 'close-x'
  | 'copy'
  | 'external'
  | 'lock'
  | 'monitor';

const PATHS: Record<IconName, ReactNode> = {
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M19.1 4.9L17 7M7 17l-2.1 2.1" />
    </>
  ),
  knob: (
    <>
      <circle cx="12" cy="12" r="8" />
      <path d="M12 12l4-4" />
      <path d="M12 4v1.5M4 12h1.5M20 12h-1.5" />
    </>
  ),
  button: (
    <>
      <rect x="3" y="7" width="18" height="12" rx="4" />
      <circle cx="12" cy="13" r="3.2" />
    </>
  ),
  wave: (
    <>
      <path d="M3 12h3l2-5 3 10 2.5-7 2 4h5.5" />
    </>
  ),
  led: (
    <>
      <circle cx="12" cy="10" r="5" />
      <path d="M10 15v3M14 15v3M9.5 20h5" />
    </>
  ),
  rgb: (
    <>
      <circle cx="9" cy="9.5" r="4.2" />
      <circle cx="15" cy="9.5" r="4.2" />
      <circle cx="12" cy="15" r="4.2" />
    </>
  ),
  buzzer: (
    <>
      <path d="M4 10v4h3l4 3V7l-4 3H4z" />
      <path d="M15 9.5c1.5 1.5 1.5 3.5 0 5M18 7c2.5 2.5 2.5 7 0 10" />
    </>
  ),
  servo: (
    <>
      <rect x="4" y="10" width="12" height="9" rx="2" />
      <path d="M16 13h4M8 10V6h4" />
      <circle cx="12" cy="6" r="2" />
    </>
  ),
  less: <path d="M16 5L7 12l9 7" />,
  greater: <path d="M8 5l9 7-9 7" />,
  equal: <path d="M6 9h12M6 15h12" />,
  back: <path d="M15 5l-7 7 7 7" />,
  check: <path d="M5 12.5l4.5 4.5L19 7" />,
  close: <path d="M6 6l12 12M18 6L6 18" />,
  warning: (
    <>
      <path d="M12 4l9 16H3l9-16z" />
      <path d="M12 10v4M12 17.2v.1" />
    </>
  ),
  play: <path d="M8 5.5l10 6.5-10 6.5v-13z" />,
  stop: <rect x="6" y="6" width="12" height="12" rx="2.5" />,
  trash: (
    <>
      <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
      <path d="M10 11v6M14 11v6" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v5h-5" />
    </>
  ),
  code: (
    <>
      <path d="M9 7l-5 5 5 5M15 7l5 5-5 5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V5M8 9l4-4 4 4" />
      <path d="M5 16v2.5h14V16" />
    </>
  ),
  chip: (
    <>
      <rect x="7" y="7" width="10" height="10" rx="2" />
      <path d="M10 3v4M14 3v4M10 17v4M14 17v4M3 10h4M3 14h4M17 10h4M17 14h4" />
    </>
  ),
  'chevron-up': <path d="M6 15l6-6 6 6" />,
  'chevron-down': <path d="M6 9l6 6 6-6" />,
  folder: <path d="M4 7a2 2 0 0 1 2-2h4l2 2h6a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7z" />,
  flask: (
    <>
      <path d="M9 3h6M10 3v6L5 19a1.6 1.6 0 0 0 1.4 2.4h11.2A1.6 1.6 0 0 0 19 19l-5-10V3" />
      <path d="M7.5 15h9" />
    </>
  ),
  sliders: (
    <>
      <path d="M5 7h14M5 17h14" />
      <circle cx="9" cy="7" r="2.2" />
      <circle cx="15" cy="17" r="2.2" />
    </>
  ),
  usb: (
    <>
      <path d="M12 21V4" />
      <path d="M9 7l3-3 3 3" />
      <path d="M12 12l4 3M12 15l-4 3" />
    </>
  ),
  layers: <path d="M12 3l9 5-9 5-9-5 9-5zM3 14l9 5 9-5" />,
  bolt: <path d="M13 3L5 14h5l-1 7 8-11h-5l1-7z" />,
  'arrow-right': <path d="M4 12h15M13 6l6 6-6 6" />,
  grid: (
    <>
      <rect x="4" y="4" width="7" height="7" rx="2" />
      <rect x="13" y="4" width="7" height="7" rx="2" />
      <rect x="4" y="13" width="7" height="7" rx="2" />
      <rect x="13" y="13" width="7" height="7" rx="2" />
    </>
  ),
  globe: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <ellipse cx="12" cy="12" rx="4" ry="8.5" />
      <path d="M3.5 12h17" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="0.6" fill="currentColor" />
    </>
  ),
  sparkles: (
    <>
      <path d="M12 4l1.8 4.7L18.5 10l-4.7 1.8L12 16.5l-1.8-4.7L5.5 10l4.7-1.3L12 4z" />
      <path d="M18.5 15.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8.8-2z" />
    </>
  ),
  ruler: (
    <>
      <rect x="2.5" y="8.5" width="19" height="7" rx="2" transform="rotate(-8 12 12)" />
      <path d="M7 10.5v2.5M11 9.7v2.5M15 8.9v2.5M19 8.1v2.5" />
    </>
  ),
  moon: <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.8 6.8 0 0 0 10.5 10.5z" />,
  plant: (
    <>
      <path d="M12 21v-8" />
      <path d="M12 13c0-3 2-5.5 6-5.5 0 3.5-2.5 5.5-6 5.5z" />
      <path d="M12 15c0-2.5-1.8-4.5-5-4.5 0 2.8 2 4.5 5 4.5z" />
    </>
  ),
  cloud: (
    <>
      <path d="M7 18a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.4 9.6 3.8 3.8 0 0 1 17 18H7z" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V6l10-2v12" />
      <circle cx="6.5" cy="18" r="2.5" />
      <circle cx="16.5" cy="16" r="2.5" />
    </>
  ),
  box: (
    <>
      <path d="M4 8l8-4 8 4v8l-8 4-8-4V8z" />
      <path d="M4 8l8 4 8-4M12 12v8" />
    </>
  ),
  bell: (
    <>
      <path d="M18 16H6c1.2-1.4 2-2.6 2-6a4 4 0 0 1 8 0c0 3.4.8 4.6 2 6z" />
      <path d="M10.5 19a1.8 1.8 0 0 0 3 0" />
    </>
  ),
  radio: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M8.2 8.2a5.4 5.4 0 0 0 0 7.6M15.8 8.2a5.4 5.4 0 0 1 0 7.6" />
      <path d="M5.4 5.4a9.3 9.3 0 0 0 0 13.2M18.6 5.4a9.3 9.3 0 0 1 0 13.2" />
    </>
  ),
  timer: (
    <>
      <circle cx="12" cy="13" r="7.5" />
      <path d="M12 9.5V13l2.5 2M9.5 2.5h5" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </>
  ),
  motion: (
    <>
      <circle cx="13.5" cy="5" r="2" />
      <path d="M12.5 8.5L9 13l3 1 1.5 6M12.5 8.5l4 2 3-1M9 13l-4 1M12.5 20l-4-1" />
    </>
  ),
  droplet: (
    <>
      <path d="M12 3.5s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.9 12 3.5 12 3.5z" />
    </>
  ),
  rain: (
    <>
      <path d="M7 15a4 4 0 0 1-.4-8A5.5 5.5 0 0 1 17.4 6.6 3.8 3.8 0 0 1 17 15H7z" />
      <path d="M9 18l-1 3M13 18l-1 3M17 18l-1 3" />
    </>
  ),
  water: (
    <>
      <path d="M4 14c2 0 2-1.5 4-1.5S10 14 12 14s2-1.5 4-1.5 2 1.5 4 1.5" />
      <path d="M4 19c2 0 2-1.5 4-1.5S10 19 12 19s2-1.5 4-1.5 2 1.5 4 1.5" />
      <path d="M7 10l3-3 3 3 4-4" />
    </>
  ),
  hand: (
    <>
      <path d="M8 12V6.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M11 11V5.5a1.5 1.5 0 0 1 3 0V12" />
      <path d="M14 11.5V7.5a1.5 1.5 0 0 1 3 0V15a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5v-3.5a1.5 1.5 0 0 1 3 0" />
    </>
  ),
  infrared: (
    <>
      <circle cx="12" cy="12" r="2.4" />
      <path d="M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7" />
      <path d="M5.5 5.5a9 9 0 0 0 0 13M18.5 5.5a9 9 0 0 1 0 13" />
    </>
  ),
  sound: (
    <>
      <path d="M9 5v14M12 8v8M15 3v18M6 10v4M18 9v6" />
    </>
  ),
  soil: (
    <>
      <path d="M12 21v-7" />
      <path d="M12 14c0-3 2-5.5 6-5.5 0 3.5-2.5 5.5-6 5.5z" />
      <path d="M3 21h18" />
    </>
  ),
  relay: (
    <>
      <rect x="3" y="8" width="18" height="9" rx="2" />
      <path d="M7 8V6M12 8V6M17 8V6" />
      <path d="M6 13h6l3-3" />
    </>
  ),
  switch: (
    <>
      <rect x="3" y="8" width="18" height="8" rx="4" />
      <circle cx="8.5" cy="12" r="3" fill="currentColor" stroke="none" />
    </>
  ),
  thermometer: (
    <>
      <path d="M13 13.5V5a2 2 0 1 0-4 0v8.5a4 4 0 1 0 4 0z" />
      <path d="M11 16.5v-3" />
    </>
  ),
  motor: (
    <>
      <circle cx="12" cy="12" r="7.5" />
      <path d="M9 15V9l3 3 3-3v6" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="M16 16l4.5 4.5" />
    </>
  ),
  list: (
    <>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4.5 6h.01M4.5 12h.01M4.5 18h.01" />
    </>
  ),
  digital: <path d="M3 15h3.5V9h4v6h4V9h4v6H21" />,
  analog: <path d="M3 12c1.6-4.4 3.2-4.4 4.8 0s3.2 4.4 4.8 0 3.2-4.4 4.8 0 3.2 4.4 4.8 0" />,
  pwm: (
    <>
      <path d="M3 16V8h2.5v8h2V8h4.5v8h2V8h6" />
      <path d="M3 20h18" />
    </>
  ),
  ground: (
    <>
      <path d="M12 4v7" />
      <path d="M6.5 11h11M9 14.5h6M11 18h2" />
    </>
  ),
  terminal: (
    <>
      <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
      <path d="M7 9.5l3 2.5-3 2.5M13 15h4" />
    </>
  ),
  swap: <path d="M4 8h14l-3.2-3.2M20 16H6l3.2 3.2" />,
  resistor: <path d="M2.5 12h4l1.6-4.2 3.2 8.4 3-8.4 1.7 4.2h5" />,
  pencil: (
    <>
      <path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
      <path d="M14.5 6.5l3 3" />
    </>
  ),
  undo: (
    <>
      <path d="M9 8H5V4" />
      <path d="M5 8a8 8 0 1 1 2.3 10" />
    </>
  ),
  redo: (
    <>
      <path d="M15 8h4V4" />
      <path d="M19 8a8 8 0 1 0-2.3 10" />
    </>
  ),
  minimize: <path d="M6 12h12" />,
  maximize: <rect x="6" y="6" width="12" height="12" rx="2" />,
  'close-x': <path d="M6 6l12 12M18 6L6 18" />,
  copy: (
    <>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M5 15V6a2 2 0 0 1 2-2h9" />
    </>
  ),
  external: (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4l-8 8" />
      <path d="M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4" />
    </>
  ),
  lock: (
    <>
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </>
  ),
  monitor: (
    <>
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M9 20h6M12 16v4" />
    </>
  ),
};

export interface IconProps {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

export function Icon({ name, size = 24, strokeWidth = 2, className }: IconProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {PATHS[name]}
    </svg>
  );
}
