export type Json = string | number | boolean | null | { [key: string]: Json } | Json[]

export interface Database {
  public: {
    Tables: {
      students: {
        Row: {
          id: string
          ra: string
          full_name: string
          grade: string
          group_name: string
          character_id: number
          created_at: string
        }
        Insert: {
          id?: string
          ra: string
          full_name: string
          grade: string
          group_name: string
          character_id?: number
          created_at?: string
        }
        Update: {
          ra?: string
          full_name?: string
          grade?: string
          group_name?: string
          character_id?: number
        }
      }
      projects: {
        Row: {
          id: string
          student_id: string
          name: string
          data: Json
          updated_at: string
          created_at: string
        }
        Insert: {
          id?: string
          student_id: string
          name: string
          data?: Json
          updated_at?: string
          created_at?: string
        }
        Update: {
          name?: string
          data?: Json
          updated_at?: string
        }
      }
    }
  }
}

export interface Student {
  id: string
  ra: string
  full_name: string
  grade: string
  group_name: string
  character_id: number
  created_at: string
}

export interface Project {
  id: string
  student_id: string
  name: string
  data: ProjectData
  updated_at: string
  created_at: string
}

export interface ProjectData {
  components: CircuitComponent[]
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export interface CircuitComponent {
  id: string
  type: ComponentType
  name: string
  category: 'actuator' | 'sensor'
  pins: PinAssignment[]
  warnings: string[]
}

export interface PinAssignment {
  label: string
  pin: string
  type: 'digital' | 'analog' | 'pwm' | 'power' | 'gnd'
}

export type ComponentType =
  | 'led' | 'rgb_led' | 'servo_180' | 'servo_360' | 'buzzer' | 'relay' | 'stepper' | 'solenoid'
  | 'potentiometer' | 'button' | 'ldr' | 'ultrasonic' | 'temperature' | 'humidity'
  | 'water_turbidity' | 'water_level' | 'rain_sensor' | 'soil_humidity'

export interface FlowNode {
  id: string
  type: string
  position: { x: number; y: number }
  data: Record<string, unknown>
}

export interface FlowEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}
