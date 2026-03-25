import type { CircuitComponent } from '../types/database'

export function generateFlowSummary(components: CircuitComponent[]): string {
  if (components.length === 0) return 'No components added yet.'

  const sensors = components.filter(c => c.category === 'sensor')
  const actuators = components.filter(c => c.category === 'actuator')

  const parts: string[] = []

  if (sensors.length > 0) {
    const names = sensors.map(s => s.name).join(', ')
    parts.push(`reads the ${names}`)
  }

  if (actuators.length > 0) {
    const names = actuators.map(a => a.name).join(' and ')
    parts.push(`controls the ${names}`)
  }

  const text = `This project ${parts.join('. It also ')}.`
  return text.charAt(0).toUpperCase() + text.slice(1)
}

export function getProjectDef(_type: string) {
  return null
}
