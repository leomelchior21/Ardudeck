/**
 * Pin model for an Arduino Uno. Pins are always written the way students see
 * them on the board ("A0", "D9") and translated to numbers only for code
 * generation and the serial protocol.
 *
 * D0/D1 are deliberately excluded everywhere: they carry the USB serial link
 * used by ArduDeck Bridge, so they can never be offered as free pins.
 */

export type AnalogPinId = 'A0' | 'A1' | 'A2' | 'A3' | 'A4' | 'A5';
export type DigitalPinId =
  | 'D2'
  | 'D3'
  | 'D4'
  | 'D5'
  | 'D6'
  | 'D7'
  | 'D8'
  | 'D9'
  | 'D10'
  | 'D11'
  | 'D12'
  | 'D13';
export type PinId = AnalogPinId | DigitalPinId;
export type PinKind = 'analog' | 'digital' | 'pwm';

export const ANALOG_PINS: readonly AnalogPinId[] = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'];

export const DIGITAL_PINS: readonly DigitalPinId[] = [
  'D2',
  'D3',
  'D4',
  'D5',
  'D6',
  'D7',
  'D8',
  'D9',
  'D10',
  'D11',
  'D12',
  'D13',
];

/** PWM-capable digital pins on the Uno (marked with ~ on the board). */
export const PWM_PINS: readonly DigitalPinId[] = ['D3', 'D5', 'D6', 'D9', 'D10', 'D11'];

export const ALL_PINS: readonly PinId[] = [...ANALOG_PINS, ...DIGITAL_PINS];

const ANALOG_NUMBERS: Record<AnalogPinId, number> = {
  A0: 14,
  A1: 15,
  A2: 16,
  A3: 17,
  A4: 18,
  A5: 19,
};

export const PIN_KIND_LABEL: Record<PinKind, string> = {
  analog: 'Analog input',
  digital: 'Digital',
  pwm: 'PWM',
};

export function isAnalogPin(pin: PinId): pin is AnalogPinId {
  return (
    pin === 'A0' ||
    pin === 'A1' ||
    pin === 'A2' ||
    pin === 'A3' ||
    pin === 'A4' ||
    pin === 'A5'
  );
}

export function isPinId(value: unknown): value is PinId {
  return typeof value === 'string' && (ALL_PINS as readonly string[]).includes(value);
}

export function isPwmPin(pin: PinId): boolean {
  return (PWM_PINS as readonly string[]).includes(pin);
}

/** Arduino pin number: A0 -> 14 ... A5 -> 19, D9 -> 9. */
export function pinNumber(pin: PinId): number {
  return isAnalogPin(pin) ? ANALOG_NUMBERS[pin] : Number(pin.slice(1));
}

/** Pins that satisfy at least one of the requested kinds, in board order. */
export function pinsForKinds(kinds: readonly PinKind[]): readonly PinId[] {
  const out: PinId[] = [];
  if (kinds.includes('analog')) out.push(...ANALOG_PINS);
  if (kinds.includes('digital')) out.push(...DIGITAL_PINS);
  if (kinds.includes('pwm')) out.push(...PWM_PINS);
  return [...new Set(out)];
}

export function isPinCompatible(pin: PinId, kinds: readonly PinKind[]): boolean {
  if (kinds.includes('analog') && isAnalogPin(pin)) return true;
  if (kinds.includes('digital') && !isAnalogPin(pin)) return true;
  if (kinds.includes('pwm') && isPwmPin(pin)) return true;
  return false;
}

export function pinCapabilityLabel(pin: PinId): string {
  if (isAnalogPin(pin)) return PIN_KIND_LABEL.analog;
  if (isPwmPin(pin)) return 'Digital + PWM';
  return PIN_KIND_LABEL.digital;
}
