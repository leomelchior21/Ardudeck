import { describe, expect, it } from 'vitest';
import {
  ALL_PINS,
  PWM_PINS,
  isPinCompatible,
  isPinId,
  pinNumber,
  pinsForKinds,
} from '../src';

describe('pins', () => {
  it('excludes the serial pins D0/D1 from the free pin pool', () => {
    expect(ALL_PINS).not.toContain('D0');
    expect(ALL_PINS).not.toContain('D1');
    expect(ALL_PINS).toHaveLength(18);
  });

  it('offers analog pins only for analog needs', () => {
    expect(pinsForKinds(['analog'])).toEqual(['A0', 'A1', 'A2', 'A3', 'A4', 'A5']);
  });

  it('offers all digital pins for digital needs', () => {
    const pins = pinsForKinds(['digital']);
    expect(pins).toContain('D2');
    expect(pins).toContain('D13');
    expect(pins).not.toContain('A0');
  });

  it('offers only PWM pins for PWM needs', () => {
    expect(pinsForKinds(['pwm'])).toEqual(PWM_PINS);
  });

  it('checks pin compatibility', () => {
    expect(isPinCompatible('A0', ['analog'])).toBe(true);
    expect(isPinCompatible('D9', ['analog'])).toBe(false);
    expect(isPinCompatible('D9', ['digital'])).toBe(true);
    expect(isPinCompatible('D9', ['pwm'])).toBe(true);
    expect(isPinCompatible('D4', ['pwm'])).toBe(false);
    expect(isPinCompatible('A0', ['digital'])).toBe(false);
  });

  it('maps pins to Arduino numbers', () => {
    expect(pinNumber('A0')).toBe(14);
    expect(pinNumber('A5')).toBe(19);
    expect(pinNumber('D13')).toBe(13);
  });

  it('recognises valid pin ids', () => {
    expect(isPinId('A3')).toBe(true);
    expect(isPinId('D9')).toBe(true);
    expect(isPinId('D0')).toBe(false);
    expect(isPinId(9)).toBe(false);
  });
});
