import { useEffect } from 'react'
import { LoginScreen } from './components/auth/LoginScreen'
import { Dashboard } from './components/fileManager/Dashboard'
import { BuilderScreen } from './components/circuit/BuilderScreen'
import { useAppStore } from './store/useAppStore'

function App() {
  const activeScreen = useAppStore(s => s.activeScreen)
  const student = useAppStore(s => s.student)
  const setActiveScreen = useAppStore(s => s.setActiveScreen)

  // If we have a persisted student but no screen set, go to dashboard
  useEffect(() => {
    if (student && activeScreen === 'login') {
      setActiveScreen('dashboard')
    }
  }, [student])

  if (activeScreen === 'login' || !student) {
    return <LoginScreen />
  }

  if (activeScreen === 'dashboard') {
    return <Dashboard />
  }

  if (activeScreen === 'builder') {
    return <BuilderScreen />
  }

  return <LoginScreen />
}

export default App
