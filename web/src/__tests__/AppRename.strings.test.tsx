import { render, screen } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { App } from '../App'
import { PasswordPage } from '../pages/PasswordPage'

describe('Phase 17 — AI Training Coach branding strings', () => {
  beforeEach(() => {
    localStorage.clear()
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({}),
    } as unknown as Response)
  })

  it('ChangePasswordPage renders "AI Training Coach" h1 heading', () => {
    // Render App with temp password flag set — shows ChangePasswordPage
    localStorage.setItem('access_token', 'fake-jwt-token')
    localStorage.setItem('auth_temp_password', 'true')
    localStorage.setItem('auth_email', 'test@example.com')

    render(<App />)

    expect(screen.getByRole('heading', { level: 1, name: 'AI Training Coach' })).toBeInTheDocument()
  })

  it('PasswordPage renders "AI Training Coach" h1 heading', () => {
    render(<PasswordPage onSuccess={() => undefined} />)

    expect(screen.getByRole('heading', { level: 1, name: 'AI Training Coach' })).toBeInTheDocument()
  })
})
