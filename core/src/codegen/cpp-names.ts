/** Identifiers that would break generated C++ if used as variable names. */
const RESERVED = new Set([
  'setup',
  'loop',
  'pinMode',
  'digitalWrite',
  'digitalRead',
  'analogRead',
  'analogWrite',
  'tone',
  'noTone',
  'pulseIn',
  'delay',
  'delayMicroseconds',
  'HIGH',
  'LOW',
  'INPUT',
  'OUTPUT',
  'INPUT_PULLUP',
  'Servo',
  'String',
  'int',
  'long',
  'void',
  'if',
  'else',
  'for',
  'while',
  'bool',
  'true',
  'false',
  'byte',
  'char',
  'float',
  'double',
  'unsigned',
  'return',
]);

/** "Light Sensor" -> "lightSensor", "read distance cm" -> "readDistanceCm". */
export function toIdentifier(text: string, fallback = 'value'): string {
  const words = text
    .replace(/[^A-Za-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 0);
  const head = words[0];
  if (head === undefined) return fallback;

  let name = head.charAt(0).toLowerCase() + head.slice(1);
  for (const word of words.slice(1)) {
    name += word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }
  if (!/^[A-Za-z_]/.test(name)) name = `${fallback}${name}`;
  if (RESERVED.has(name)) name = `${name}Value`;
  return name;
}

export function uniqueName(base: string, taken: Set<string>): string {
  let name = base;
  let suffix = 2;
  while (taken.has(name)) {
    name = `${base}${suffix}`;
    suffix += 1;
  }
  taken.add(name);
  return name;
}

/** Arduino sketch folders must be simple names: letters, digits, _ and -. */
export function sanitizeSketchName(name: string): string {
  const cleaned = name
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
  const safe = cleaned.length > 0 ? cleaned : 'ArduDeckProject';
  return /^[0-9]/.test(safe) ? `P_${safe}` : safe;
}
