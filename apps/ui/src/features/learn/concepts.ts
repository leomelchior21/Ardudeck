import type { IconName } from '../../ui/Icon';

export type ConceptId =
  | 'digital'
  | 'analog'
  | 'pwm'
  | 'power'
  | 'gnd'
  | 'io'
  | 'serial'
  | 'components';

export interface LearnExample {
  icon: IconName;
  title: string;
  sub: string;
}

export interface Concept {
  id: ConceptId;
  label: string;
  sub: string;
  icon: IconName;
  title: string;
  blurb: string;
  why: string;
  tip: string;
  /** Accent used for the board highlight and callouts. */
  accent: string;
  examples: LearnExample[];
}

/**
 * The Learn page content. Each concept owns its board highlight (in
 * ArduinoBoard) and its visual demo (in demos.tsx).
 */
export const CONCEPTS: Concept[] = [
  {
    id: 'digital',
    label: 'Digital Pins',
    sub: 'HIGH or LOW',
    icon: 'digital',
    title: 'Digital Pins',
    blurb: 'Digital pins work with two states: LOW or HIGH. They are great for LEDs, buttons, and buzzers.',
    why: 'Digital means two states. LOW (0) or HIGH (1). It is like a light switch - either off or on.',
    tip: 'LED on D9',
    accent: '#c9f24b',
    examples: [
      { icon: 'led', title: 'Blink an LED', sub: 'Connect an LED to D9' },
      { icon: 'button', title: 'Read a Button', sub: 'Connect a button to D2' },
      { icon: 'buzzer', title: 'Play a Buzzer', sub: 'Connect a buzzer to D8' },
    ],
  },
  {
    id: 'analog',
    label: 'Analog Pins',
    sub: 'Read changing values',
    icon: 'analog',
    title: 'Analog Pins',
    blurb: 'Analog pins read values that change gradually. They are useful for light, sound, and knobs.',
    why: 'Analog means many levels. The value can go from 0 to 1023, not just on or off.',
    tip: 'Light sensor on A0',
    accent: '#8fd0f5',
    examples: [
      { icon: 'sun', title: 'Measure Light', sub: 'Light sensor on A0' },
      { icon: 'knob', title: 'Turn a Knob', sub: 'Potentiometer on A1' },
      { icon: 'sound', title: 'Listen to Sound', sub: 'Sound sensor on A2' },
    ],
  },
  {
    id: 'pwm',
    label: 'PWM',
    sub: 'Analog-like output',
    icon: 'pwm',
    title: 'PWM',
    blurb: 'PWM switches a digital pin on and off very fast, so an LED looks dimmer or a motor turns slower.',
    why: 'PWM is fast pulses that control brightness or speed. It is not true analog output, but it feels like it.',
    tip: 'Fade an LED on D9',
    accent: '#b9a6ff',
    examples: [
      { icon: 'led', title: 'Fade an LED', sub: 'PWM output on D9' },
      { icon: 'motor', title: 'Control a Motor', sub: 'Speed on D5' },
      { icon: 'bolt', title: 'Dim a Lamp', sub: 'Use a PWM pin' },
    ],
  },
  {
    id: 'power',
    label: 'Power',
    sub: '5V, 3.3V, VIN',
    icon: 'bolt',
    title: 'Power Pins',
    blurb: 'Power pins feed your components. 5V and 3.3V give a steady supply, and VIN takes an external battery.',
    why: 'Power pins are where the energy comes from in the circuit.',
    tip: '5V and GND to the breadboard',
    accent: '#f2544b',
    examples: [
      { icon: 'bolt', title: '5V Rail', sub: 'Send 5V to the breadboard' },
      { icon: 'motor', title: 'Battery In', sub: '7-12V on VIN' },
      { icon: 'led', title: 'Light an LED', sub: '5V to the LED' },
    ],
  },
  {
    id: 'gnd',
    label: 'GND',
    sub: 'Common ground',
    icon: 'ground',
    title: 'Ground',
    blurb: 'Ground is the return path for current. Every circuit needs a GND so the electricity can complete the loop.',
    why: 'Without GND the circuit does not complete, and nothing works.',
    tip: 'LED cathode to GND',
    accent: '#f6d84b',
    examples: [
      { icon: 'led', title: 'Light an LED', sub: '5V -> LED -> GND' },
      { icon: 'button', title: 'Wire a Button', sub: 'Button to GND' },
      { icon: 'relay', title: 'Share Ground', sub: 'Join all GNDs' },
    ],
  },
  {
    id: 'io',
    label: 'Inputs / Outputs',
    sub: 'Read & control',
    icon: 'swap',
    title: 'Inputs and Outputs',
    blurb: 'Inputs bring information in. Outputs send actions out. Arduino reads the world, then changes it.',
    why: 'Arduino reads the world through inputs and changes the world through outputs.',
    tip: 'Button on D2, LED on D9',
    accent: '#c9f24b',
    examples: [
      { icon: 'button', title: 'Read a Button', sub: 'Input on D2' },
      { icon: 'led', title: 'Light an LED', sub: 'Output on D9' },
      { icon: 'buzzer', title: 'Sound a Buzzer', sub: 'Output on D8' },
    ],
  },
  {
    id: 'serial',
    label: 'Serial',
    sub: 'Talk to the computer',
    icon: 'terminal',
    title: 'Serial',
    blurb: 'Serial is how the board talks to the computer. It sends text both ways over the USB cable.',
    why: 'This is how data moves between the board and the computer.',
    tip: 'Open the Serial Monitor',
    accent: '#c3b2f7',
    examples: [
      { icon: 'monitor', title: 'Open the Monitor', sub: 'See values live' },
      { icon: 'terminal', title: 'Send a Command', sub: 'Type to your board' },
      { icon: 'code', title: 'Print a Value', sub: 'Serial.println()' },
    ],
  },
  {
    id: 'components',
    label: 'Basic Components',
    sub: 'LEDs, buttons, sensors',
    icon: 'box',
    title: 'Basic Components',
    blurb: 'These are the building blocks you will use most: LEDs, resistors, buttons, buzzers, and sensors.',
    why: 'With a few common parts you can build almost anything.',
    tip: 'LED + resistor + button',
    accent: '#8fd0f5',
    examples: [
      { icon: 'led', title: 'LED', sub: 'Shows an output' },
      { icon: 'button', title: 'Button', sub: 'A simple input' },
      { icon: 'knob', title: 'Potentiometer', sub: 'Adjust a value' },
    ],
  },
];
