import type { ComponentType } from '../types/database'

export interface ComponentDef {
  type: ComponentType
  name: string
  category: 'actuator' | 'sensor'
  icon: string
  color: string
  bgClass: string
  pinRequirements: PinRequirement[]
  power?: string
  notes?: string
}

export interface PinRequirement {
  label: string
  preferredType: 'digital' | 'analog' | 'pwm' | 'power' | 'gnd'
  count?: number
  suffix?: string[]
}

export const COMPONENT_DEFS: ComponentDef[] = [
  // ACTUATORS
  {
    type: 'led',
    name: 'LED',
    category: 'actuator',
    icon: '💡',
    color: '#f5c518',
    bgClass: 'comp-led',
    pinRequirements: [{ label: 'Signal', preferredType: 'pwm' }],
    notes: 'Use 220Ω Resistor',
  },
  {
    type: 'rgb_led',
    name: 'RGB LED',
    category: 'actuator',
    icon: '🌈',
    color: '#c084fc',
    bgClass: 'comp-rgb',
    pinRequirements: [
      { label: 'R', preferredType: 'pwm' },
      { label: 'G', preferredType: 'pwm' },
      { label: 'B', preferredType: 'pwm' },
    ],
    notes: 'Use 220Ω on each channel',
  },
  {
    type: 'servo_180',
    name: 'Servo 180°',
    category: 'actuator',
    icon: '⚙️',
    color: '#f97316',
    bgClass: 'comp-servo',
    pinRequirements: [{ label: 'Signal', preferredType: 'pwm' }],
    power: 'Use external 5V',
  },
  {
    type: 'servo_360',
    name: 'Servo 360°',
    category: 'actuator',
    icon: '🔄',
    color: '#ea580c',
    bgClass: 'comp-servo',
    pinRequirements: [{ label: 'Signal', preferredType: 'pwm' }],
    power: 'Use external 5V',
  },
  {
    type: 'buzzer',
    name: 'Buzzer',
    category: 'actuator',
    icon: '🔊',
    color: '#ef4444',
    bgClass: 'comp-buzzer',
    pinRequirements: [{ label: 'Signal', preferredType: 'digital' }],
  },
  {
    type: 'relay',
    name: 'Relay',
    category: 'actuator',
    icon: '🔌',
    color: '#22c55e',
    bgClass: 'comp-relay',
    pinRequirements: [{ label: 'IN', preferredType: 'digital' }],
    notes: '⚠ High voltage – be careful!',
  },
  {
    type: 'stepper',
    name: 'Stepper 28BYJ-48',
    category: 'actuator',
    icon: '🔩',
    color: '#3b82f6',
    bgClass: 'comp-sensor',
    pinRequirements: [
      { label: 'IN1', preferredType: 'digital' },
      { label: 'IN2', preferredType: 'digital' },
      { label: 'IN3', preferredType: 'digital' },
      { label: 'IN4', preferredType: 'digital' },
    ],
    power: 'External 5V recommended',
  },
  {
    type: 'solenoid',
    name: 'Solenoid',
    category: 'actuator',
    icon: '🧲',
    color: '#6366f1',
    bgClass: 'comp-sensor',
    pinRequirements: [{ label: 'Signal', preferredType: 'digital' }],
    notes: '⚠ Needs transistor + flyback diode',
  },
  // SENSORS
  {
    type: 'potentiometer',
    name: 'Potentiometer',
    category: 'sensor',
    icon: '🎛',
    color: '#84cc16',
    bgClass: 'comp-pot',
    pinRequirements: [{ label: 'Signal', preferredType: 'analog' }],
  },
  {
    type: 'button',
    name: 'Button',
    category: 'sensor',
    icon: '🔘',
    color: '#4a9eff',
    bgClass: 'comp-sensor',
    pinRequirements: [{ label: 'Signal', preferredType: 'digital' }],
    notes: 'Use pull-down resistor',
  },
  {
    type: 'ldr',
    name: 'LDR (Light)',
    category: 'sensor',
    icon: '☀️',
    color: '#fbbf24',
    bgClass: 'comp-pot',
    pinRequirements: [{ label: 'Signal', preferredType: 'analog' }],
    notes: 'Use 10kΩ voltage divider',
  },
  {
    type: 'ultrasonic',
    name: 'Ultrasonic',
    category: 'sensor',
    icon: '📡',
    color: '#06b6d4',
    bgClass: 'comp-sensor',
    pinRequirements: [
      { label: 'Trig', preferredType: 'digital' },
      { label: 'Echo', preferredType: 'digital' },
    ],
  },
  {
    type: 'temperature',
    name: 'Temperature (NTC)',
    category: 'sensor',
    icon: '🌡',
    color: '#f87171',
    bgClass: 'comp-buzzer',
    pinRequirements: [{ label: 'Signal', preferredType: 'analog' }],
    notes: 'Use 10kΩ resistor',
  },
  {
    type: 'humidity',
    name: 'Humidity (DHT11)',
    category: 'sensor',
    icon: '💧',
    color: '#38bdf8',
    bgClass: 'comp-sensor',
    pinRequirements: [{ label: 'Data', preferredType: 'digital' }],
  },
  {
    type: 'water_turbidity',
    name: 'Water Turbidity',
    category: 'sensor',
    icon: '🌊',
    color: '#0284c7',
    bgClass: 'comp-sensor',
    pinRequirements: [{ label: 'Signal', preferredType: 'analog' }],
  },
  {
    type: 'water_level',
    name: 'Water Level',
    category: 'sensor',
    icon: '📊',
    color: '#0ea5e9',
    bgClass: 'comp-sensor',
    pinRequirements: [{ label: 'Signal', preferredType: 'analog' }],
  },
  {
    type: 'rain_sensor',
    name: 'Rain Sensor',
    category: 'sensor',
    icon: '🌧',
    color: '#6366f1',
    bgClass: 'comp-sensor',
    pinRequirements: [
      { label: 'Analog', preferredType: 'analog' },
      { label: 'Digital', preferredType: 'digital' },
    ],
  },
  {
    type: 'soil_humidity',
    name: 'Soil Humidity',
    category: 'sensor',
    icon: '🌱',
    color: '#86efac',
    bgClass: 'comp-pot',
    pinRequirements: [{ label: 'Signal', preferredType: 'analog' }],
  },
]

export const ACTUATORS = COMPONENT_DEFS.filter(c => c.category === 'actuator')
export const SENSORS = COMPONENT_DEFS.filter(c => c.category === 'sensor')

export function getComponentDef(type: ComponentType): ComponentDef | undefined {
  return COMPONENT_DEFS.find(c => c.type === type)
}
