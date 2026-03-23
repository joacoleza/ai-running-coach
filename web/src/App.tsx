import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { Dashboard } from './pages/Dashboard'
import { TrainingPlan } from './pages/TrainingPlan'
import { Runs } from './pages/Runs'
import { PasswordPage } from './pages/PasswordPage'

export function App() {
  const [authenticated, setAuthenticated] = useState(() => !!localStorage.getItem('app_password'))

  useEffect(() => {
    const originalFetch = window.fetch
    window.fetch = async (...args) => {
      const response = await originalFetch(...args)
      if (response.status === 401) {
        localStorage.removeItem('app_password')
        setAuthenticated(false)
      }
      return response
    }
    return () => {
      window.fetch = originalFetch
    }
  }, [])

  if (!authenticated) {
    return <PasswordPage onSuccess={() => setAuthenticated(true)} />
  }

  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/plan" element={<TrainingPlan />} />
          <Route path="/runs" element={<Runs />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  )
}

export default App
