import { useState } from 'react'
import { WindowFrame } from '../ui/WindowFrame'
import { CircuitPanel } from './CircuitPanel'
import { FlowPanel } from '../flow/FlowPanel'
import { useAppStore } from '../../store/useAppStore'
import { saveProject } from '../../lib/supabase'

export function BuilderScreen() {
  const student = useAppStore(s => s.student)
  const currentProject = useAppStore(s => s.currentProject)
  const setCurrentProject = useAppStore(s => s.setCurrentProject)
  const projects = useAppStore(s => s.projects)
  const setProjects = useAppStore(s => s.setProjects)
  const projectDirty = useAppStore(s => s.projectDirty)
  const setProjectDirty = useAppStore(s => s.setProjectDirty)
  const setActiveScreen = useAppStore(s => s.setActiveScreen)
  const getProjectData = useAppStore(s => s.getProjectData)

  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const handleSave = async () => {
    if (!student || !currentProject) return
    setSaving(true)
    const data = getProjectData()
    const { project: saved, error } = await saveProject({
      id: currentProject.id || undefined,
      student_id: student.id,
      name: currentProject.name,
      data,
    })
    setSaving(false)

    if (error) {
      setSaveMsg('❌ Save failed')
    } else {
      setSaveMsg('✅ Saved!')
      if (saved) {
        setCurrentProject(saved)
        const existing = projects.find(p => p.id === saved.id)
        if (existing) {
          setProjects(projects.map(p => p.id === saved.id ? saved : p))
        } else {
          setProjects([saved, ...projects])
        }
      }
      setProjectDirty(false)
    }
    setTimeout(() => setSaveMsg(''), 2000)
  }

  const handleBack = () => {
    if (projectDirty) {
      if (!confirm('You have unsaved changes. Go back without saving?')) return
    }
    setActiveScreen('dashboard')
  }

  return (
    <WindowFrame
      title={currentProject?.name ?? 'ArduDeck'}
      topRight={
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* RA badge */}
          {student && (
            <div
              style={{
                fontFamily: 'var(--font-pixel)',
                fontSize: 9,
                background: '#f0ead6',
                border: '3px solid #2d2d2d',
                padding: '5px 10px',
                boxShadow: '3px 3px 0 #2d2d2d',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              🔌 {student.ra}
            </div>
          )}
          {/* Back button */}
          <button
            className="pixel-btn pixel-btn-gray"
            style={{ fontSize: 9 }}
            onClick={handleBack}
          >
            ◀ Back
          </button>
          {/* Save feedback */}
          {saveMsg && (
            <span style={{ fontFamily: 'var(--font-pixel)', fontSize: 9, color: saveMsg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>
              {saveMsg}
            </span>
          )}
          {/* Save button */}
          <button
            className={`pixel-btn ${projectDirty ? 'pixel-btn-green' : 'pixel-btn-gray'}`}
            style={{ fontSize: 9 }}
            onClick={handleSave}
            disabled={saving || !projectDirty}
          >
            {saving ? <span className="pixel-blink">💾 Saving...</span> : '💾 Save'}
          </button>
        </div>
      }
    >
      {/* LEFT — Circuit Builder */}
      <div
        style={{
          width: 300,
          minWidth: 260,
          borderRight: '4px solid #2d2d2d',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <CircuitPanel />
      </div>

      {/* RIGHT — Logic Flowchart */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <FlowPanel />
      </div>
    </WindowFrame>
  )
}
