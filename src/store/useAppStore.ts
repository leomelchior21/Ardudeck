import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Student, Project, CircuitComponent, FlowNode, FlowEdge, ProjectData, ComponentType } from '../types/database'
import { assignPins } from '../logic/pinEngine'
import { getComponentDef } from '../data/components'
import type { Edge, Node } from 'reactflow'

let _componentCounter = 0

interface AppState {
  // Auth
  student: Student | null
  setStudent: (s: Student | null) => void

  // Projects list
  projects: Project[]
  setProjects: (p: Project[]) => void

  // Current project
  currentProject: Project | null
  setCurrentProject: (p: Project | null) => void
  projectDirty: boolean
  setProjectDirty: (d: boolean) => void

  // Circuit components
  components: CircuitComponent[]
  addComponent: (type: ComponentType) => void
  removeComponent: (id: string) => void

  // Flow
  flowNodes: Node[]
  flowEdges: Edge[]
  setFlowNodes: (nodes: Node[]) => void
  setFlowEdges: (edges: Edge[]) => void

  // UI state
  activeScreen: 'login' | 'dashboard' | 'builder'
  setActiveScreen: (s: 'login' | 'dashboard' | 'builder') => void

  // Actions
  loadProject: (project: Project) => void
  createNewProject: (name: string) => void
  getProjectData: () => ProjectData
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      student: null,
      setStudent: (student) => set({ student }),

      projects: [],
      setProjects: (projects) => set({ projects }),

      currentProject: null,
      setCurrentProject: (p) => set({ currentProject: p }),
      projectDirty: false,
      setProjectDirty: (d) => set({ projectDirty: d }),

      components: [],
      addComponent: (type) => {
        const state = get()
        const id = `comp_${Date.now()}_${_componentCounter++}`
        const { pins, warnings } = assignPins(state.components, type, id)
        const def = getComponentDef(type)
        const newComp: CircuitComponent = {
          id,
          type,
          name: def?.name ?? String(type),
          category: def?.category ?? 'sensor',
          pins,
          warnings,
        }
        const newComponents = [...state.components, newComp]
        const { nodes, edges } = syncFlowFromComponents(newComponents, state.flowNodes, state.flowEdges)
        set({ components: newComponents, flowNodes: nodes, flowEdges: edges, projectDirty: true })
      },

      removeComponent: (id) => {
        const state = get()
        const newComponents = state.components.filter(c => c.id !== id)
        const { nodes, edges } = syncFlowFromComponents(newComponents, state.flowNodes, state.flowEdges)
        set({ components: newComponents, flowNodes: nodes, flowEdges: edges, projectDirty: true })
      },

      flowNodes: [],
      flowEdges: [],
      setFlowNodes: (nodes) => set({ flowNodes: nodes, projectDirty: true }),
      setFlowEdges: (edges) => set({ flowEdges: edges, projectDirty: true }),

      activeScreen: 'login',
      setActiveScreen: (s) => set({ activeScreen: s }),

      loadProject: (project) => {
        const data = (project.data as unknown as ProjectData) || { components: [], nodes: [], edges: [] }
        set({
          currentProject: project,
          components: data.components || [],
          flowNodes: (data.nodes || []) as Node[],
          flowEdges: (data.edges || []) as Edge[],
          projectDirty: false,
          activeScreen: 'builder',
        })
      },

      createNewProject: (name) => {
        const student = get().student
        if (!student) return
        const newProject: Project = {
          id: '',
          student_id: student.id,
          name,
          data: { components: [], nodes: [], edges: [] },
          updated_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        }
        set({
          currentProject: newProject,
          components: [],
          flowNodes: [],
          flowEdges: [],
          projectDirty: true,
          activeScreen: 'builder',
        })
      },

      getProjectData: () => {
        const state = get()
        return {
          components: state.components,
          nodes: state.flowNodes as unknown as FlowNode[],
          edges: state.flowEdges as unknown as FlowEdge[],
        }
      },
    }),
    {
      name: 'ardudeck-session',
      partialize: (state) => ({
        student: state.student,
      }),
    }
  )
)

function syncFlowFromComponents(
  components: CircuitComponent[],
  existingNodes: Node[],
  existingEdges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  const existingNodeIds = new Set(existingNodes.map(n => n.id))
  const newNodes: Node[] = [...existingNodes]

  components.forEach((comp, i) => {
    const nodeId = `node_${comp.id}`
    if (!existingNodeIds.has(nodeId)) {
      const isSensor = comp.category === 'sensor'
      newNodes.push({
        id: nodeId,
        type: isSensor ? 'sensorNode' : 'actionNode',
        position: {
          x: 80 + (i % 4) * 220,
          y: isSensor ? 60 : 300,
        },
        data: {
          label: comp.name,
          componentId: comp.id,
          category: comp.category,
        },
      })
    }
  })

  const compNodeIds = new Set(components.map(c => `node_${c.id}`))
  const filteredNodes = newNodes.filter(n =>
    n.id.startsWith('node_comp_') ? compNodeIds.has(n.id) : true
  )

  const nodeIds = new Set(filteredNodes.map(n => n.id))
  const filteredEdges = existingEdges.filter(
    e => nodeIds.has(e.source) && nodeIds.has(e.target)
  )

  return { nodes: filteredNodes, edges: filteredEdges }
}
