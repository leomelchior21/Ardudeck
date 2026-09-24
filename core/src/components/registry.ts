import type {
  BlockFieldSpec,
  BlockSpec,
  ComponentDef,
  ComponentCategory,
  NodeComponentId,
  PinSpec,
} from './types';

/** Every actuator understands a wait: it pauses the sequence it belongs to. */
const DELAY_BLOCK: BlockSpec = {
  kind: 'delay',
  label: 'Wait',
  text: 'DELAY',
  numbers: [{ id: 'ms', min: 0, max: 5000, step: 50, unit: 'ms', defaultValue: 500 }],
};

const ANGLE_BLOCK: BlockSpec = {
  kind: 'angle',
  label: 'Move to angle',
  text: 'ANGLE',
  numbers: [{ id: 'angle', min: 0, max: 180, step: 5, unit: 'deg', defaultValue: 90 }],
};

const SPEED_BLOCK: BlockFieldSpec = {
  id: 'speed',
  min: 0,
  max: 255,
  step: 5,
  defaultValue: 200,
};

/**
 * The component library. Everything the UI, the validator and the code
 * generator know about a component lives here as data - no component is
 * hardcoded into a screen.
 *
 * To add a component: add a definition here, make sure the validator and the
 * code generator understand its category/behaviour, and the UI picks it up
 * automatically.
 */
export const COMPONENTS: Record<NodeComponentId, ComponentDef> = {
  ldr: {
    id: 'ldr',
    name: 'Light Sensor',
    shortName: 'LIGHT',
    category: 'sensor',
    icon: 'sun',
    summary: 'Read ambient light value',
    varBase: 'light',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['analog'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    reading: {
      kind: 'analog',
      unit: '',
      min: 0,
      max: 1023,
      decimals: 0,
      lowLabel: 'Dark',
      highLabel: 'Bright',
    },
    safety:
      'Build a voltage divider: Light sensor to 5V, 10 kOhm resistor to GND, and the middle point to the analog pin.',
    live: true,
    deployable: true,
  },

  potentiometer: {
    id: 'potentiometer',
    name: 'Knob',
    shortName: 'KNOB',
    category: 'sensor',
    icon: 'knob',
    summary: 'Read a knob position',
    varBase: 'knob',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['analog'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    reading: {
      kind: 'analog',
      unit: '',
      min: 0,
      max: 1023,
      decimals: 0,
      lowLabel: 'Left',
      highLabel: 'Right',
    },
    safety:
      'Connect the two outer legs to 5V and GND, and the middle leg to the analog pin.',
    live: true,
    deployable: true,
  },

  button: {
    id: 'button',
    name: 'Button',
    shortName: 'BUTTON',
    category: 'sensor',
    icon: 'button',
    summary: 'Sense a button press',
    varBase: 'button',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['digital'] }],
    wiring: [{ label: 'GND', role: 'ground' }],
    fields: [
      {
        type: 'select',
        id: 'wiring',
        label: 'Wiring',
        options: [
          { value: 'gnd', label: 'Button to GND', hint: 'Recommended. Uses the built-in pull-up.' },
          { value: '5v', label: 'Button to 5V', hint: 'Needs a 10 kOhm resistor to GND.' },
        ],
        defaultValue: 'gnd',
      },
    ],
    reading: {
      kind: 'digital',
      unit: '',
      min: 0,
      max: 1,
      decimals: 0,
      lowLabel: 'Released',
      highLabel: 'Pressed',
    },
    safety: 'One side of the button goes to the pin, the other side to GND (or 5V).',
    live: true,
    deployable: true,
  },

  ultrasonic: {
    id: 'ultrasonic',
    name: 'Distance Sensor',
    shortName: 'DISTANCE',
    category: 'sensor',
    icon: 'wave',
    summary: 'Measure distance',
    varBase: 'distance',
    pins: [
      { id: 'trig', label: 'TRIG', kinds: ['digital'], help: 'Sends the ping.' },
      { id: 'echo', label: 'ECHO', kinds: ['digital'], help: 'Listens for the echo.' },
    ],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    reading: {
      kind: 'distance',
      unit: 'cm',
      min: 0,
      max: 200,
      decimals: 0,
      lowLabel: 'Close',
      highLabel: 'Far',
    },
    safety:
      'HC-SR04 runs on 5V. VCC to 5V, GND to GND, and keep TRIG and ECHO on different pins.',
    live: true,
    deployable: true,
  },

  pir: {
    id: 'pir',
    name: 'PIR Motion',
    shortName: 'MOTION',
    category: 'sensor',
    icon: 'motion',
    summary: 'Detect movement',
    varBase: 'motion',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['digital'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    reading: {
      kind: 'digital',
      unit: '',
      min: 0,
      max: 1,
      decimals: 0,
      lowLabel: 'Still',
      highLabel: 'Motion',
    },
    safety:
      'HC-SR501 runs on 5V. The output goes HIGH while motion is detected. It needs a few seconds to warm up.',
    live: true,
    deployable: true,
  },

  switch: {
    id: 'switch',
    name: 'Switch',
    shortName: 'SWITCH',
    category: 'sensor',
    icon: 'switch',
    summary: 'Read a switch position',
    varBase: 'switch',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['digital'] }],
    wiring: [{ label: 'GND', role: 'ground' }],
    fields: [
      {
        type: 'select',
        id: 'wiring',
        label: 'Wiring',
        options: [
          { value: 'gnd', label: 'Switch to GND', hint: 'Recommended. Uses the built-in pull-up.' },
          { value: '5v', label: 'Switch to 5V', hint: 'Needs a 10 kOhm resistor to GND.' },
        ],
        defaultValue: 'gnd',
      },
    ],
    reading: {
      kind: 'digital',
      unit: '',
      min: 0,
      max: 1,
      decimals: 0,
      lowLabel: 'Off',
      highLabel: 'On',
    },
    safety: 'One side of the switch goes to the pin, the other side to GND (or 5V).',
    live: true,
    deployable: true,
  },

  temperature: {
    id: 'temperature',
    name: 'Temperature',
    shortName: 'TEMP',
    category: 'sensor',
    icon: 'thermometer',
    summary: 'Read temperature',
    varBase: 'temperature',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['analog'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    reading: {
      kind: 'analog',
      unit: '',
      min: 0,
      max: 1023,
      decimals: 0,
      lowLabel: 'Cold',
      highLabel: 'Hot',
    },
    safety:
      'Use an analog temperature module (TMP36 or LM35). ArduDeck shows the raw analog value, so check the module datasheet for its conversion.',
    live: true,
    deployable: true,
  },

  humidity: {
    id: 'humidity',
    name: 'Humidity',
    shortName: 'HUMID',
    category: 'sensor',
    icon: 'droplet',
    summary: 'Read humidity',
    varBase: 'humidity',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['analog'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    reading: {
      kind: 'analog',
      unit: '',
      min: 0,
      max: 1023,
      decimals: 0,
      lowLabel: 'Dry',
      highLabel: 'Humid',
    },
    safety:
      'Use a humidity module with an analog output. ArduDeck shows the raw analog value; the module datasheet maps it to % humidity.',
    live: true,
    deployable: true,
  },

  rain: {
    id: 'rain',
    name: 'Rain',
    shortName: 'RAIN',
    category: 'sensor',
    icon: 'rain',
    summary: 'Detect water',
    varBase: 'rain',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['analog'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    reading: {
      kind: 'analog',
      unit: '',
      min: 0,
      max: 1023,
      decimals: 0,
      lowLabel: 'Wet',
      highLabel: 'Dry',
    },
    safety: 'Rain boards usually read HIGH when dry. Place the pad where water can drain away.',
    live: true,
    deployable: true,
  },

  water: {
    id: 'water',
    name: 'Water Level',
    shortName: 'WATER',
    category: 'sensor',
    icon: 'water',
    summary: 'Read the water level',
    varBase: 'waterLevel',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['analog'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    reading: {
      kind: 'analog',
      unit: '',
      min: 0,
      max: 1023,
      decimals: 0,
      lowLabel: 'Empty',
      highLabel: 'Full',
    },
    safety:
      'Water level boards output an analog value that rises with the water. Keep the electronics above the water line.',
    live: true,
    deployable: true,
  },

  touch: {
    id: 'touch',
    name: 'Touch',
    shortName: 'TOUCH',
    category: 'sensor',
    icon: 'hand',
    summary: 'Sense a touch',
    varBase: 'touch',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['digital'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    reading: {
      kind: 'digital',
      unit: '',
      min: 0,
      max: 1,
      decimals: 0,
      lowLabel: 'Released',
      highLabel: 'Touched',
    },
    safety: 'A capacitive touch module outputs HIGH while it is touched.',
    live: true,
    deployable: true,
  },

  infrared: {
    id: 'infrared',
    name: 'Infrared IR',
    shortName: 'IR',
    category: 'sensor',
    icon: 'infrared',
    summary: 'Detect an object',
    varBase: 'infrared',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['digital'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    reading: {
      kind: 'digital',
      unit: '',
      min: 0,
      max: 1,
      decimals: 0,
      lowLabel: 'Clear',
      highLabel: 'Object',
    },
    safety:
      'Many IR obstacle modules output LOW when they see an object. If yours is inverted, swap the true and false actions.',
    live: true,
    deployable: true,
  },

  sound: {
    id: 'sound',
    name: 'Sound Sensor',
    shortName: 'SOUND',
    category: 'sensor',
    icon: 'sound',
    summary: 'Listen to loudness',
    varBase: 'sound',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['analog'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    reading: {
      kind: 'analog',
      unit: '',
      min: 0,
      max: 1023,
      decimals: 0,
      lowLabel: 'Quiet',
      highLabel: 'Loud',
    },
    safety: 'Sound modules output a small analog signal. Turn the potentiometer on the module to set its sensitivity.',
    live: true,
    deployable: true,
  },

  soil: {
    id: 'soil',
    name: 'Soil Moisture',
    shortName: 'SOIL',
    category: 'sensor',
    icon: 'soil',
    summary: 'Read soil wetness',
    varBase: 'soil',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['analog'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    reading: {
      kind: 'analog',
      unit: '',
      min: 0,
      max: 1023,
      decimals: 0,
      lowLabel: 'Wet',
      highLabel: 'Dry',
    },
    safety: 'Do not leave the probe powered in wet soil all the time: it corrodes. Power it only while reading.',
    live: true,
    deployable: true,
  },

  led: {
    id: 'led',
    name: 'LED',
    shortName: 'LED',
    category: 'actuator',
    icon: 'led',
    summary: 'Turn an LED on or off',
    subtitle: 'LED, Light Emitting Diode',
    varBase: 'led',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['digital'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [
      {
        type: 'select',
        id: 'whenTrue',
        label: 'When the rule is true',
        options: [
          { value: 'on', label: 'LED ON' },
          { value: 'off', label: 'LED OFF' },
        ],
        defaultValue: 'on',
      },
    ],
    blocks: [
      { kind: 'high', label: 'Turn HIGH', text: 'HIGH' },
      { kind: 'low', label: 'Turn LOW', text: 'LOW' },
      DELAY_BLOCK,
    ],
    defaultBlock: 'high',
    safety:
      'Always put a resistor (220-330 Ohm) in series with the LED. The long leg goes to the pin.',
    live: true,
    deployable: true,
  },

  buzzer: {
    id: 'buzzer',
    name: 'Buzzer',
    shortName: 'BUZZER',
    category: 'actuator',
    icon: 'buzzer',
    summary: 'Play a tone while the rule is true',
    subtitle: 'Buzzer, makes a beep',
    varBase: 'buzzer',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['digital'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [
      {
        type: 'select',
        id: 'whenTrue',
        label: 'When the rule is true',
        options: [
          { value: 'beep', label: 'Play a tone' },
          { value: 'silent', label: 'Stay silent' },
        ],
        defaultValue: 'beep',
      },
      {
        type: 'number',
        id: 'frequency',
        label: 'Tone',
        min: 100,
        max: 2000,
        step: 10,
        unit: 'Hz',
        defaultValue: 440,
      },
      {
        type: 'number',
        id: 'durationMs',
        label: 'Length',
        min: 30,
        max: 2000,
        step: 10,
        unit: 'ms',
        defaultValue: 200,
      },
    ],
    blocks: [
      {
        kind: 'tone',
        label: 'Play a tone',
        text: 'TONE',
        numbers: [
          { id: 'frequency', min: 100, max: 2000, step: 10, unit: 'Hz', defaultValue: 440 },
          { id: 'durationMs', min: 30, max: 2000, step: 10, unit: 'ms', defaultValue: 200 },
        ],
      },
      { kind: 'silent', label: 'Stay silent', text: 'SILENT' },
      DELAY_BLOCK,
    ],
    defaultBlock: 'tone',
    safety: 'A small piezo buzzer can be driven directly. Louder buzzers need a transistor driver.',
    live: true,
    deployable: true,
  },

  servo: {
    id: 'servo',
    name: 'Servo 180',
    shortName: 'SERVO',
    category: 'actuator',
    icon: 'servo',
    summary: 'Move a servo arm to an angle.',
    subtitle: 'Servo motor, 0 to 180 degrees',
    varBase: 'servo',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['digital'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [
      {
        type: 'number',
        id: 'angle',
        label: 'Angle when true',
        min: 0,
        max: 180,
        step: 5,
        unit: 'deg',
        defaultValue: 90,
      },
      {
        type: 'number',
        id: 'restAngle',
        label: 'Angle when false',
        min: 0,
        max: 180,
        step: 5,
        unit: 'deg',
        defaultValue: 0,
      },
    ],
    blocks: [ANGLE_BLOCK, DELAY_BLOCK],
    defaultBlock: 'angle',
    safety:
      'Servos draw a lot of current. Power the servo from a separate 5-6V supply and connect the grounds together.',
    live: true,
    deployable: true,
  },

  servo360: {
    id: 'servo360',
    name: 'Servo 360',
    shortName: 'SERVO 360',
    category: 'actuator',
    icon: 'servo',
    summary: 'Spin a continuous servo.',
    subtitle: 'Servo motor, continuous spin',
    varBase: 'servo',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['digital'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [
      {
        type: 'number',
        id: 'speedTrue',
        label: 'Speed when true',
        min: 0,
        max: 180,
        step: 5,
        defaultValue: 120,
      },
      {
        type: 'number',
        id: 'restSpeed',
        label: 'Speed when false',
        min: 0,
        max: 180,
        step: 5,
        defaultValue: 90,
      },
    ],
    blocks: [
      {
        kind: 'speed',
        label: 'Set speed',
        text: 'SPEED',
        numbers: [{ id: 'speed', min: 0, max: 180, step: 5, unit: 'deg', defaultValue: 120 }],
      },
      DELAY_BLOCK,
    ],
    defaultBlock: 'speed',
    safety:
      'A continuous servo uses 90 as stop: below 90 turns one way, above 90 the other. Power it from a separate 5-6V supply.',
    live: true,
    deployable: true,
  },

  relay: {
    id: 'relay',
    name: 'Relay',
    shortName: 'RELAY',
    category: 'actuator',
    icon: 'relay',
    summary: 'Switch a bigger load.',
    subtitle: 'Relay module, switches a device',
    varBase: 'relay',
    pins: [{ id: 'signal', label: 'Signal', kinds: ['digital'] }],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [
      {
        type: 'select',
        id: 'load',
        label: 'What it switches',
        options: [
          { value: 'fan', label: 'Fan' },
          { value: 'atomizer', label: 'Atomizer' },
          { value: 'pump', label: 'Water pump' },
          { value: 'lamp', label: 'Lamp' },
          { value: 'heater', label: 'Heater' },
          { value: 'valve', label: 'Solenoid valve' },
        ],
        defaultValue: 'fan',
      },
      {
        type: 'select',
        id: 'whenTrue',
        label: 'When the rule is true',
        options: [
          { value: 'on', label: 'Relay ON' },
          { value: 'off', label: 'Relay OFF' },
        ],
        defaultValue: 'on',
      },
    ],
    blocks: [
      { kind: 'high', label: 'Turn HIGH', text: 'HIGH' },
      { kind: 'low', label: 'Turn LOW', text: 'LOW' },
      DELAY_BLOCK,
    ],
    defaultBlock: 'high',
    safety:
      'Never switch mains voltage on a breadboard. Use a relay module with its own driver and keep the load wires away from the Arduino.',
    live: true,
    deployable: true,
  },

  rgb: {
    id: 'rgb',
    name: 'RGB LED',
    shortName: 'RGB',
    category: 'actuator',
    icon: 'rgb',
    summary: 'Mix red, green and blue light.',
    subtitle: 'RGB LED, red green blue',
    varBase: 'rgbLed',
    pins: [
      { id: 'red', label: 'Red', kinds: ['pwm'] },
      { id: 'green', label: 'Green', kinds: ['pwm'] },
      { id: 'blue', label: 'Blue', kinds: ['pwm'] },
    ],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    blocks: [
      {
        kind: 'color',
        label: 'Show a colour',
        text: 'COLOUR',
        color: true,
        numbers: [
          { id: 'red', min: 0, max: 255, step: 5, defaultValue: 255 },
          { id: 'green', min: 0, max: 255, step: 5, defaultValue: 255 },
          { id: 'blue', min: 0, max: 255, step: 5, defaultValue: 255 },
        ],
      },
      { kind: 'high', label: 'All channels HIGH', text: 'ALL HIGH' },
      { kind: 'low', label: 'All channels LOW', text: 'ALL LOW' },
      DELAY_BLOCK,
    ],
    defaultBlock: 'color',
    requiresBlocks: true,
    safety:
      'Use PWM pins (3, 5, 6, 9, 10, 11) and one 220-330 Ohm resistor per colour leg. Add the colour blocks in the order you want them to run.',
    live: true,
    deployable: true,
  },

  motor: {
    id: 'motor',
    name: 'Motor Driver L298N',
    shortName: 'MOTOR',
    category: 'actuator',
    icon: 'motor',
    summary: 'Spin a DC motor both ways with speed control.',
    subtitle: 'L298N motor driver, DC motor',
    varBase: 'motor',
    pins: [
      { id: 'in1', label: 'IN1', kinds: ['digital'] },
      { id: 'in2', label: 'IN2', kinds: ['digital'] },
      { id: 'enable', label: 'EN', kinds: ['pwm'] },
    ],
    wiring: [
      { label: '5V', role: 'power' },
      { label: 'GND', role: 'ground' },
    ],
    fields: [],
    blocks: [
      { kind: 'forward', label: 'Forward', text: 'FORWARD', numbers: [SPEED_BLOCK] },
      { kind: 'reverse', label: 'Reverse', text: 'REVERSE', numbers: [SPEED_BLOCK] },
      { kind: 'brake', label: 'Brake', text: 'BRAKE' },
      { kind: 'stop', label: 'Stop', text: 'STOP' },
      DELAY_BLOCK,
    ],
    defaultBlock: 'stop',
    requiresBlocks: true,
    safety:
      'Power the motor from its own battery pack and connect the grounds together. Never power a motor from the Arduino 5V pin.',
    live: true,
    deployable: true,
  },

  delay: {
    id: 'delay',
    name: 'Delay',
    shortName: 'DELAY',
    category: 'actuator',
    icon: 'timer',
    summary: 'Wait before the next loop.',
    subtitle: 'Delay, pause the sequence',
    varBase: 'wait',
    pins: [],
    fields: [
      {
        type: 'number',
        id: 'ms',
        label: 'Wait',
        min: 0,
        max: 5000,
        step: 50,
        unit: 'ms',
        defaultValue: 500,
      },
    ],
    safety: 'A delay pauses the whole program. Keep it short so sensors still react quickly.',
    live: true,
    deployable: true,
  },

  lessThan: {
    id: 'lessThan',
    name: 'Less Than',
    shortName: 'LESS THAN',
    category: 'condition',
    icon: 'less',
    summary: 'True when the value is below your number.',
    varBase: 'less',
    pins: [],
    fields: [
      {
        type: 'number',
        id: 'value',
        label: 'Value',
        min: 0,
        max: 1023,
        step: 1,
        defaultValue: 300,
      },
    ],
    live: true,
    deployable: true,
  },

  greaterThan: {
    id: 'greaterThan',
    name: 'Greater Than',
    shortName: 'GREATER THAN',
    category: 'condition',
    icon: 'greater',
    summary: 'True when the value is above your number.',
    varBase: 'greater',
    pins: [],
    fields: [
      {
        type: 'number',
        id: 'value',
        label: 'Value',
        min: 0,
        max: 1023,
        step: 1,
        defaultValue: 300,
      },
    ],
    live: true,
    deployable: true,
  },

  equalsTo: {
    id: 'equalsTo',
    name: 'Equals',
    shortName: 'EQUALS',
    category: 'condition',
    icon: 'equal',
    summary: 'True when the value is exactly your number.',
    varBase: 'equals',
    pins: [],
    fields: [
      {
        type: 'number',
        id: 'value',
        label: 'Value',
        min: 0,
        max: 1023,
        step: 1,
        defaultValue: 1,
      },
    ],
    live: true,
    deployable: true,
  },

  lessThanOrEqual: {
    id: 'lessThanOrEqual',
    name: 'Less Than or Equal',
    shortName: 'LESS OR EQUAL',
    category: 'condition',
    icon: 'less',
    summary: 'True when the value is your number or below.',
    varBase: 'lessEqual',
    pins: [],
    fields: [
      { type: 'number', id: 'value', label: 'Value', min: 0, max: 1023, step: 1, defaultValue: 300 },
    ],
    live: true,
    deployable: true,
  },

  greaterThanOrEqual: {
    id: 'greaterThanOrEqual',
    name: 'Greater Than or Equal',
    shortName: 'GREATER OR EQUAL',
    category: 'condition',
    icon: 'greater',
    summary: 'True when the value is your number or above.',
    varBase: 'greaterEqual',
    pins: [],
    fields: [
      { type: 'number', id: 'value', label: 'Value', min: 0, max: 1023, step: 1, defaultValue: 300 },
    ],
    live: true,
    deployable: true,
  },

  notEquals: {
    id: 'notEquals',
    name: 'Not Equal To',
    shortName: 'NOT EQUAL',
    category: 'condition',
    icon: 'equal',
    summary: 'True when the value is different from your number.',
    varBase: 'notEquals',
    pins: [],
    fields: [
      { type: 'number', id: 'value', label: 'Value', min: 0, max: 1023, step: 1, defaultValue: 1 },
    ],
    live: true,
    deployable: true,
  },
};

export function getComponent(id: string): ComponentDef | undefined {
  return (COMPONENTS as Record<string, ComponentDef | undefined>)[id];
}

export function listByCategory(category: ComponentCategory): ComponentDef[] {
  return Object.values(COMPONENTS).filter((def) => def.category === category);
}

export function findPinSpec(def: ComponentDef, pinId: string): PinSpec | undefined {
  return def.pins.find((pin) => pin.id === pinId);
}

export const CATEGORIES: readonly ComponentCategory[] = ['sensor', 'condition', 'actuator'];

export const CATEGORY_LABEL: Record<ComponentCategory, string> = {
  sensor: 'Sensors',
  condition: 'Conditions',
  actuator: 'Actions',
};

