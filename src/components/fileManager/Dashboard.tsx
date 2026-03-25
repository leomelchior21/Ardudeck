import { useEffect, useState } from 'react'
import { WindowFrame } from '../ui/WindowFrame'
import { useAppStore } from '../../store/useAppStore'
import { getProjects, deleteProject } from '../../lib/supabase'
import type { Project } from '../../types/database'
import { ProfilePanel } from '../profile/ProfilePanel'
import { CharacterSelector } from '../profile/CharacterSelector'

const PROJECT_ICONS: Record<string, string> = {
  motion: '🧩',
  servo: '⚙️',
  led: '💡',
  buzzer: '🔊',
  rgb: '🌈',
  ultrasonic: '📡',
  default: '📁',
}

function getProjectIcon(name: string): string {
  const lower = name.toLowerCase()
  for (const [key, icon] of Object.entries(PROJECT_ICONS)) {
    if (lower.includes(key)) return icon
  }
  return PROJECT_ICONS.default
}

export function Dashboard() {
  const student = useAppStore(s => s.student)
  const projects = useAppStore(s => s.projects)
  const setProjects = useAppStore(s => s.setProjects)
  const loadProject = useAppStore(s => s.loadProject)
  const createNewProject = useAppStore(s => s.createNewProject)
  const setActiveScreen = useAppStore(s => s.setActiveScreen)
  const setStudent = useAppStore(s => s.setStudent)

  const [showNewModal, setShowNewModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [showCharSelector, setShowCharSelector] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!student) return
    setLoading(true)
    getProjects(student.id).then(({ projects: p }) => {
      setProjects(p as Project[])
      setLoading(false)
    })
  }, [student])

  const handleOpenProject = (project: Project) => {
    loadProject(project)
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('Delete this project?')) return
    setDeletingId(projectId)
    await deleteProject(projectId)
    setProjects(projects.filter(p => p.id !== projectId))
    setDeletingId(null)
  }

  const handleCreateNew = async () => {
    if (!newProjectName.trim()) return
    setShowNewModal(false)
    createNewProject(newProjectName.trim())
    setNewProjectName('')
  }

  const handleLogout = () => {
    setStudent(null)
    setActiveScreen('login')
  }

  if (!student) return null

  return (
    <>
      <WindowFrame
        title="ArduDeck"
        topRight={
          <button
            className="pixel-btn pixel-btn-green"
            style={{ fontSize: 9 }}
          >
            💾 Save
          </button>
        }
      >
        {/* LEFT — File Manager */}
        <div
          style={{
            width: '62%',
            borderRight: '4px solid #2d2d2d',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          <div className="pixel-panel-header">Student Circuit Files</div>
          <div style={{ padding: 20, flex: 1, overflowY: 'auto' }}>
            {/* Create new */}
            <button
              className="pixel-btn pixel-btn-yellow"
              style={{ marginBottom: 20, fontSize: 10 }}
              onClick={() => setShowNewModal(true)}
            >
              ➕ Create New
            </button>

            {/* My Projects label */}
            <div
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 10,
                marginBottom: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              My Projects
              <span style={{ flex: 1, borderBottom: '2px dotted #2d2d2d', display: 'inline-block', marginBottom: 3 }} />
            </div>

            {loading ? (
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: '#888' }}>
                <span className="pixel-blink">Loading...</span>
              </div>
            ) : projects.length === 0 ? (
              <div style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: '#888', lineHeight: 2 }}>
                No projects yet. Create your first one!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {projects.map(project => (
                  <ProjectRow
                    key={project.id}
                    project={project}
                    onOpen={() => handleOpenProject(project)}
                    onDelete={() => handleDeleteProject(project.id)}
                    deleting={deletingId === project.id}
                  />
                ))}
              </div>
            )}

            {/* Recycle bin */}
            <div style={{ marginTop: 24 }}>
              <div
                className="dotted-sep"
                style={{ margin: '12px 0' }}
              />
              <button
                style={{
                  fontFamily: 'var(--font-pixel)',
                  fontSize: 9,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                🗑 Recycle Bin
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT — Profile */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div className="pixel-panel-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            Profile Preview
            <button
              className="pixel-btn pixel-btn-red"
              style={{ fontSize: 8, padding: '4px 8px', boxShadow: '2px 2px 0 #2d2d2d' }}
              onClick={handleLogout}
            >
              Logout
            </button>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 20 }}>
            <ProfilePanel student={student} onEditCharacter={() => setShowCharSelector(true)} />
          </div>
        </div>
      </WindowFrame>

      {/* New Project Modal */}
      {showNewModal && (
        <Modal title="New Project" onClose={() => setShowNewModal(false)}>
          <div style={{ marginBottom: 16 }}>
            <label
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 9,
                display: 'block',
                marginBottom: 8,
              }}
            >
              Project Name:
            </label>
            <input
              className="pixel-input"
              autoFocus
              value={newProjectName}
              onChange={e => setNewProjectName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleCreateNew()}
              placeholder="e.g. LED Blinker..."
              maxLength={50}
            />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="pixel-btn pixel-btn-green" onClick={handleCreateNew} disabled={!newProjectName.trim()}>
              ✅ Create
            </button>
            <button className="pixel-btn pixel-btn-gray" onClick={() => setShowNewModal(false)}>
              Cancel
            </button>
          </div>
        </Modal>
      )}

      {/* Character Selector Modal */}
      {showCharSelector && (
        <Modal title="Choose Character" onClose={() => setShowCharSelector(false)} wide>
          <CharacterSelector onClose={() => setShowCharSelector(false)} />
        </Modal>
      )}
    </>
  )
}

function ProjectRow({
  project,
  onOpen,
  onDelete,
  deleting,
}: {
  project: Project
  onOpen: () => void
  onDelete: () => void
  deleting: boolean
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 12px',
        border: '3px solid #2d2d2d',
        background: '#fffef0',
        boxShadow: '3px 3px 0 #2d2d2d',
        cursor: 'pointer',
        transition: 'transform 0.05s',
      }}
      onClick={onOpen}
      onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.transform = 'translate(-1px,-1px)')}
      onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.transform = 'none')}
    >
      <span style={{ fontSize: 18, minWidth: 28 }}>{getProjectIcon(project.name)}</span>
      <span
        style={{
          fontFamily: 'var(--font-pixel)',
          fontSize: 9,
          flex: 1,
        }}
      >
        {project.name}
      </span>
      <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: '#888' }}>▶</span>
      <button
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          fontSize: 14,
          padding: 2,
          opacity: deleting ? 0.5 : 1,
        }}
        onClick={e => { e.stopPropagation(); onDelete() }}
        title="Delete project"
      >
        🗑️
      </button>
    </div>
  )
}

function Modal({
  title,
  onClose,
  children,
  wide,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  wide?: boolean
}) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#f0ead6',
          border: '4px solid #2d2d2d',
          boxShadow: '6px 6px 0 #2d2d2d',
          width: wide ? 700 : 380,
          maxWidth: '95vw',
          maxHeight: '90vh',
          overflow: 'auto',
        }}
        onClick={e => e.stopPropagation()}
      >
        <div
          style={{
            borderBottom: '3px solid #2d2d2d',
            padding: '10px 16px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ddd8c0',
          }}
        >
          <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 10 }}>{title}</span>
          <button
            style={{
              fontFamily: 'var(--font-pixel)',
              fontSize: 12,
              background: '#ef4444',
              border: '2px solid #2d2d2d',
              cursor: 'pointer',
              color: '#fff',
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
            }}
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div style={{ padding: 20 }}>{children}</div>
      </div>
    </div>
  )
}

// Fix missing import
import type { ReactNode } from 'react'
