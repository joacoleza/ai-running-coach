import { render, screen, act, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { App } from '../App'

// MemoryRouter is not needed — App provides its own BrowserRouter when authenticated.
// jsdom provides a basic window.location that BrowserRouter can use.

describe('App auth gate', () => {
  beforeEach(() => {
    localStorage.clear()
    // Reset fetch to a default noop to prevent test pollution
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 } as Response)
  })

  it('renders PasswordPage (AI Running Coach heading) when no app_password in localStorage', () => {
    render(<App />)
    expect(screen.getByText('AI Running Coach')).toBeInTheDocument()
  })

  it('renders AppShell with Dashboard nav link when app_password is set in localStorage', async () => {
    localStorage.setItem('app_password', 'test-password')
    // Provide a json() method so useChat's fetchPlan doesn't throw
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ plan: null }),
    } as unknown as Response)

    await act(async () => {
      render(<App />)
    })
    // Allow pending async effects (fetchPlan, fetchMessages) to resolve
    await waitFor(() => {
      const dashboardElements = screen.getAllByText('Dashboard')
      expect(dashboardElements.length).toBeGreaterThan(0)
    })
  })

  it('clears localStorage and shows PasswordPage after 401 response', async () => {
    localStorage.setItem('app_password', 'test-password')

    // Mock fetch to return 401 so the interceptor triggers
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
    } as Response)

    render(<App />)

    // Trigger a fetch call — the App useEffect wraps window.fetch, so calling it triggers the interceptor
    await act(async () => {
      await window.fetch('/api/test')
    })

    expect(screen.getByText('AI Running Coach')).toBeInTheDocument()
    expect(localStorage.getItem('app_password')).toBeNull()
  })
})
