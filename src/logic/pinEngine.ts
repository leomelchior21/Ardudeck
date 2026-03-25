import type { CircuitComponent, ComponentType, PinAssignment } from '../types/database'
import type { ComponentDef } from '../data/components'
import { getComponentDef } from '../data/components'

// Available Arduino Uno pins
const DIGITAL_PINS = ['D2', 'D4', 'D5', 'D6', 'D7', 'D8', 'D12', 'D13']
const PWM_PINS = ['D3', 'D5', 'D6', 'D9', 'D10', 'D11']
const ANALOG_PINS = ['A0', 'A1', 'A2', 'A3', 'A4', 'A5']

// PWM pins are also digital
const ALL_DIGITAL = [...new Set([...DIGITAL_PINS, ...PWM_PINS])]

export interface PinStatus {
  pin: string
  usedBy: string // component id
  label: string
}

export function assignPins(
  existingComponents: CircuitComponent[],
  newCompType: ComponentType,
  _newCompId: string
): { pins: PinAssignment[]; warnings: string[] } {
  const def = getComponentDef(newCompType)
  if (!def) return { pins: [], warnings: ['Unknown component type'] }

  // Build used pins map
  const usedPins = new Set<string>()
  for (const comp of existingComponents) {
    for (const pin of comp.pins) {
      if (pin.pin !== '5V' && pin.pin !== 'GND' && pin.pin !== 'Vin' && pin.pin !== 'VCC') {
        usedPins.add(pin.pin)
      }
    }
  }

  const pins: PinAssignment[] = []
  const warnings: string[] = []

  for (const req of def.pinRequirements) {
    let assigned = ''
    let type = req.preferredType

    if (req.preferredType === 'analog') {
      const available = ANALOG_PINS.filter(p => !usedPins.has(p))
      if (available.length === 0) {
        warnings.push(`No analog pins available for ${req.label}`)
        assigned = 'A?'
      } else {
        assigned = available[0]
        usedPins.add(assigned)
      }
    } else if (req.preferredType === 'pwm') {
      const available = PWM_PINS.filter(p => !usedPins.has(p))
      if (available.length === 0) {
        // fallback to digital
        const digAvail = DIGITAL_PINS.filter(p => !usedPins.has(p))
        if (digAvail.length === 0) {
          warnings.push(`No PWM/digital pins available for ${req.label}`)
          assigned = 'D?'
        } else {
          assigned = digAvail[0]
          type = 'digital'
          warnings.push(`${req.label}: Using digital pin (PWM preferred)`)
          usedPins.add(assigned)
        }
      } else {
        assigned = available[0]
        usedPins.add(assigned)
      }
    } else if (req.preferredType === 'digital') {
      const available = ALL_DIGITAL.filter(p => !usedPins.has(p))
      if (available.length === 0) {
        warnings.push(`No digital pins available for ${req.label}`)
        assigned = 'D?'
      } else {
        assigned = available[0]
        usedPins.add(assigned)
      }
    } else if (req.preferredType === 'power') {
      assigned = '5V'
    } else if (req.preferredType === 'gnd') {
      assigned = 'GND'
    }

    pins.push({ label: req.label, pin: assigned, type })
  }

  // Add power/gnd implicitly
  pins.push({ label: 'VCC', pin: getPowerPin(def), type: 'power' })
  pins.push({ label: 'GND', pin: 'GND', type: 'gnd' })

  if (def.notes) warnings.push(def.notes)

  return { pins, warnings }
}

function getPowerPin(def: ComponentDef): string {
  if (def.power?.includes('Vin')) return 'Vin'
  if (def.power?.includes('external')) return 'External 5V'
  return '5V'
}

export function checkPinConflicts(components: CircuitComponent[]): Map<string, string[]> {
  const pinMap = new Map<string, string[]>() // pin → [compId, ...]
  for (const comp of components) {
    for (const pin of comp.pins) {
      if (pin.type === 'power' || pin.type === 'gnd') continue
      const existing = pinMap.get(pin.pin) || []
      existing.push(comp.id)
      pinMap.set(pin.pin, existing)
    }
  }
  const conflicts = new Map<string, string[]>()
  for (const [pin, comps] of pinMap.entries()) {
    if (comps.length > 1) conflicts.set(pin, comps)
  }
  return conflicts
}

export function getPinBadgeLabel(pin: PinAssignment): string {
  if (pin.type === 'pwm') return `~${pin.pin}`
  return pin.pin
}

export function getPinColor(pin: PinAssignment, hasConflict: boolean): string {
  if (hasConflict) return '#ef4444'
  if (pin.pin.includes('?')) return '#eab308'
  if (pin.type === 'analog') return '#4a9eff'
  if (pin.type === 'pwm') return '#a855f7'
  if (pin.type === 'power') return '#f97316'
  if (pin.type === 'gnd') return '#6b7280'
  return '#22c55e'
}
