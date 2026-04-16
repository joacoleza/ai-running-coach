import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { App } from '../App'

// MemoryRouter is not needed — App provides its own BrowserRouter when authenticated.
// jsdom provides a basic window.location that BrowserRouter can use.

describe('App auth gate', () => {
  beforeEach(() => {
    localStorage.clear()
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, json: vi.fn().mockResolvedValue({}) } as unknown as Response)
  })

  it('renders LoginPage (AI Running Coach heading + Log In button) when no access_token in localStorage', () => {
    render(<App />)
    expect(screen.getByText('AI Running Coach')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
  })

  it('renders ChangePasswordPage when access_token is set and auth_temp_password is true', async () => {
    localStorage.setItem('access_token', 'fake-jwt-token')
    localStorage.setItem('auth_temp_password', 'true')
    localStorage.setItem('auth_email', 'test@example.com')

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ plan: null }),
    } as unknown as Response)

    render(<App />)
    expect(screen.getByText('Change Your Password')).toBeInTheDocument()
  })

  it('renders AppShell with Dashboard nav when access_token is set and auth_temp_password is false', async () => {
    localStorage.setItem('access_token', 'fake-jwt-token')
    localStorage.setItem('auth_temp_password', 'false')
    localStorage.setItem('auth_email', 'test@example.com')

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ plan: null, linkedRuns: {} }),
    } as unknown as Response)

    await act(async () => {
      render(<App />)
    })
    await waitFor(() => {
      const dashboardElements = screen.getAllByText('Dashboard')
      expect(dashboardElements.length).toBeGreaterThan(0)
    })
  })

  it('clears access_token and shows LoginPage after 401 response when no refresh_token', async () => {
    localStorage.setItem('access_token', 'fake-jwt-token')
    localStorage.setItem('auth_temp_password', 'false')

    // Use a single mock function that we can control per URL
    const mockFetchFn = vi.fn().mockImplementation(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === 'string' ? input : (input as Request).url ?? String(input)
      if (url.includes('/api/auth/refresh')) {
        return { ok: false, status: 401 } as Response
      }
      if (url.includes('/api/auth/')) {
        return { ok: true, status: 200, json: async () => ({}) } as unknown as Response
      }
      if (url.includes('/api/test')) {
        return { ok: false, status: 401 } as Response
      }
      // All other API calls (plan, messages, runs, etc.) succeed
      return { ok: true, status: 200, json: async () => ({ plan: null, linkedRuns: {}, messages: [], runs: [], total: 0 }) } as unknown as Response
    })
    global.fetch = mockFetchFn

    await act(async () => {
      render(<App />)
    })

    // Wait for AppShell to render (authenticated)
    await waitFor(() => {
      const dashboardElements = screen.queryAllByText('Dashboard')
      expect(dashboardElements.length).toBeGreaterThan(0)
    })

    // Trigger a fetch that returns 401 — interceptor tries refresh (also fails) → logout
    await act(async () => {
      await window.fetch('/api/test')
    })

    // After 401 with no valid refresh, App should show LoginPage
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
    })
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('ChangePasswordPage calls logout on 401 response', async () => {
    localStorage.setItem('access_token', 'fake-jwt')
    localStorage.setItem('auth_temp_password', 'true')
    localStorage.setItem('auth_email', 'test@example.com')

    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as Request).url ?? String(input)
      if (url.includes('/api/auth/change-password')) {
        return { ok: false, status: 401 } as Response
      }
      return { ok: true, status: 200, json: async () => ({}) } as unknown as Response
    })

    await act(async () => {
      render(<App />)
    })

    expect(screen.getByText('Change Your Password')).toBeInTheDocument()

    const newPasswordInput = screen.getByLabelText(/new password/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

    await act(async () => {
      fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } })
    })

    await act(async () => {
      fireEvent.submit(newPasswordInput.closest('form')!)
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /log in/i })).toBeInTheDocument()
    })
    expect(localStorage.getItem('access_token')).toBeNull()
  })

  it('ChangePasswordPage reads fresh token from localStorage on success', async () => {
    localStorage.setItem('access_token', 'old-token')
    localStorage.setItem('refresh_token', 'r')
    localStorage.setItem('auth_temp_password', 'true')
    localStorage.setItem('auth_email', 'test@example.com')
    localStorage.setItem('auth_is_admin', 'false')

    global.fetch = vi.fn().mockImplementation(async (input: RequestInfo | URL) => {
      const url = typeof input === 'string' ? input : (input as Request).url ?? String(input)
      if (url.includes('/api/auth/change-password')) {
        // Simulate interceptor refreshing the token before our response handler runs
        localStorage.setItem('access_token', 'new-token')
        return { ok: true, status: 200 } as Response
      }
      return { ok: true, status: 200, json: async () => ({}) } as unknown as Response
    })

    await act(async () => {
      render(<App />)
    })

    expect(screen.getByText('Change Your Password')).toBeInTheDocument()

    const newPasswordInput = screen.getByLabelText(/new password/i)
    const confirmPasswordInput = screen.getByLabelText(/confirm password/i)

    await act(async () => {
      fireEvent.change(newPasswordInput, { target: { value: 'newpass123' } })
      fireEvent.change(confirmPasswordInput, { target: { value: 'newpass123' } })
    })

    await act(async () => {
      fireEvent.submit(newPasswordInput.closest('form')!)
    })

    await waitFor(() => {
      expect(localStorage.getItem('auth_temp_password')).toBe('false')
    })
    expect(localStorage.getItem('access_token')).toBe('new-token')
  })
})
