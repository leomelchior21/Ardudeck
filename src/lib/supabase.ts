import { createClient } from '@supabase/supabase-js'
import type { Student, Project } from '../types/database'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('Supabase env vars not set. Running in demo mode.')
}

// Using untyped client to avoid generated-type conflicts
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const supabase = createClient<any>(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-key'
)

export async function loginWithRA(ra: string): Promise<{ student: Student | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from('students')
      .select('*')
      .eq('ra', ra.trim().toUpperCase())
      .single()

    if (error || !data) {
      return { student: null, error: 'RA not found. Ask your teacher for your RA number.' }
    }
    return { student: data as Student, error: null }
  } catch {
    return { student: null, error: 'Connection error. Check your internet.' }
  }
}

export async function getProjects(studentId: string): Promise<{ projects: Project[]; error: unknown }> {
  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('student_id', studentId)
    .order('updated_at', { ascending: false })

  return { projects: (data as Project[]) || [], error }
}

export async function saveProject(project: {
  id?: string
  student_id: string
  name: string
  data: unknown
}): Promise<{ project: Project | null; error: unknown }> {
  if (project.id) {
    const { data, error } = await supabase
      .from('projects')
      .update({ name: project.name, data: project.data, updated_at: new Date().toISOString() })
      .eq('id', project.id)
      .select()
      .single()
    return { project: data as Project, error }
  } else {
    const { data, error } = await supabase
      .from('projects')
      .insert({ student_id: project.student_id, name: project.name, data: project.data })
      .select()
      .single()
    return { project: data as Project, error }
  }
}

export async function deleteProject(projectId: string): Promise<{ error: unknown }> {
  const { error } = await supabase.from('projects').delete().eq('id', projectId)
  return { error }
}

export async function updateCharacter(studentId: string, characterId: number): Promise<{ error: unknown }> {
  const { error } = await supabase
    .from('students')
    .update({ character_id: characterId })
    .eq('id', studentId)
  return { error }
}
