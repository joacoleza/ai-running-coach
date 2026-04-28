import { useLayoutEffect, useRef } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppShell } from './components/layout/AppShell'
import { ChatProvider } from './contexts/ChatContext'
import { AuthProvider, useAuth } from './contexts/AuthContext'
import { LoginPage } from './pages/LoginPage'
import { ChangePasswordPage } from './pages/ChangePasswordPage'
import { Dashboard } from './pages/Dashboard'
import { TrainingPlan } from './pages/TrainingPlan'
import { Runs } from './pages/Runs'
import { Archive } from './pages/Archive'
import { ArchivePlan } from './pages/ArchivePlan'
import { Admin } from './pages/Admin'
import { Usage } from './pages/Usage'

// Inner component — uses useAuth(), must be inside AuthProvider
function AppInner() {
  const { token, tempPassword, login, logout, isAdmin } = useAuth()
  const isRefreshing = useRef(false)
  const refreshQueue = useRef<Array<(newToken: string | null) => void>>([])

  // useLayoutEffect ensures the interceptor is installed before any child useEffect runs
  // (all layout effects fire before passive effects across the entire tree), fixing the
  // race where useChat's init fetch fires before the 401→refresh handler is in place.
  useLayoutEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async (...args) => {
      const response = await originalFetch(...args)

      if (response.status !== 401) return response

      // Do not intercept auth endpoints (prevents infinite loops)
      const url = typeof args[0] === 'string' ? args[0] : (args[0] as Request).url
      if (url.includes('/api/auth/login') || url.includes('/api/auth/refresh') || url.includes('/api/auth/logout') || url.includes('/api/auth/change-password')) {
        return response
      }

      // Concurrent 401s during refresh: queue and wait for single refresh call
      if (isRefreshing.current) {
        return new Promise<Response>((resolve) => {
          refreshQueue.current.push((newToken) => {
            if (!newToken) {
              resolve(response)
              return
            }
            // Retry with new token
            const [input, init = {}] = args
            const headers = new Headers((init as RequestInit).headers)
            headers.set('X-Authorization', `Bearer ${newToken}`)
            resolve(originalFetch(input, { ...(init as RequestInit), headers }))
          })
        })
      }

      isRefreshing.current = true
      const storedRefreshToken = localStorage.getItem('refresh_token')

      try {
        const refreshRes = await originalFetch('/api/auth/refresh', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
        })

        if (!refreshRes.ok) {
          // Refresh failed — log out
          logout()
          refreshQueue.current.forEach((cb) => cb(null))
          refreshQueue.current = []
          isRefreshing.current = false
          return response
        }

        const data = await refreshRes.json() as { token: string }
        const newToken = data.token
        // Update localStorage (AuthContext.login would require all fields; update token only)
        localStorage.setItem('access_token', newToken)
        // Update AuthContext state to reflect new token
        const refreshToken = localStorage.getItem('refresh_token') ?? ''
        const email = localStorage.getItem('auth_email') ?? ''
        const isAdmin = localStorage.getItem('auth_is_admin') === 'true'
        const isTempPassword = localStorage.getItem('auth_temp_password') === 'true'
        login(newToken, refreshToken, email, isAdmin, isTempPassword)

        // Drain the queue with the new token
        refreshQueue.current.forEach((cb) => cb(newToken))
        refreshQueue.current = []
        isRefreshing.current = false

        // Retry the original request with the new token
        const [input, init = {}] = args
        const headers = new Headers((init as RequestInit).headers)
        headers.set('X-Authorization', `Bearer ${newToken}`)
        const retryResponse = await originalFetch(input, { ...(init as RequestInit), headers })

        // If the retry still returns 401 (e.g. JWT_SECRET mismatch across instances),
        // log out to force re-login rather than leaving the user in a broken state.
        if (retryResponse.status === 401) {
          logout()
        }

        return retryResponse
      } catch {
        logout()
        refreshQueue.current.forEach((cb) => cb(null))
        refreshQueue.current = []
        isRefreshing.current = false
        return response
      }
    }

    return () => {
      window.fetch = originalFetch
    }
  }, [login, logout])

  // D-03: App-level gate — no URL routes for login/change-password
  if (!token) {
    return <LoginPage onTempPassword={() => {}} />
  }

  if (tempPassword) {
    return <ChangePasswordPage />
  }

  return (
    <BrowserRouter>
      <ChatProvider>
        <AppShell>
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/plan" element={<TrainingPlan />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/runs" element={<Runs />} />
            <Route path="/archive" element={<Archive />} />
            <Route path="/archive/:id" element={<ArchivePlan />} />
            <Route path="/usage" element={<Usage />} />
            <Route path="/admin" element={isAdmin ? <Admin /> : <Navigate to="/dashboard" replace />} />
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </AppShell>
      </ChatProvider>
    </BrowserRouter>
  )
}

export function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  )
}

export default App
