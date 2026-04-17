/**
 * AUTH-04: ChangePasswordPage component validation tests
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ChangePasswordPage } from '../pages/ChangePasswordPage'

// Mock AuthContext — ChangePasswordPage calls useAuth()
const mockLogin = vi.fn()
const mockLogout = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'fake-token',
    email: 'test@example.com',
    isAdmin: false,
    tempPassword: true,
    login: mockLogin,
    logout: mockLogout,
  }),
}))

describe('ChangePasswordPage validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
    localStorage.setItem('refresh_token', 'fake-refresh-token')
  })

  it('shows "Password must be at least 8 characters" when newPassword is non-empty and shorter than 8 chars', () => {
    render(<ChangePasswordPage />)

    const newPasswordInput = screen.getByLabelText('New Password')
    fireEvent.change(newPasswordInput, { target: { value: 'short' } })

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument()
  })

  it('does not show "Password must be at least 8 characters" when newPassword is empty', () => {
    render(<ChangePasswordPage />)

    expect(screen.queryByText('Password must be at least 8 characters')).not.toBeInTheDocument()
  })

  it('shows "Passwords do not match" when both fields are filled but differ', () => {
    render(<ChangePasswordPage />)

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password2' } })

    expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  })

  it('does not show "Passwords do not match" when only newPassword is filled', () => {
    render(<ChangePasswordPage />)

    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'password1' } })

    expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument()
  })

  it('submit button is disabled when both fields are empty', () => {
    render(<ChangePasswordPage />)
    const button = screen.getByRole('button', { name: /change password/i })
    expect(button).toBeDisabled()
  })

  it('submit button is disabled when only newPassword is filled', () => {
    render(<ChangePasswordPage />)
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'password1' } })
    const button = screen.getByRole('button', { name: /change password/i })
    expect(button).toBeDisabled()
  })

  it('submit button is disabled when passwords match but shorter than 8 chars', () => {
    render(<ChangePasswordPage />)
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'short' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'short' } })
    const button = screen.getByRole('button', { name: /change password/i })
    expect(button).toBeDisabled()
  })

  it('submit button is disabled when passwords do not match', () => {
    render(<ChangePasswordPage />)
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'password1' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'password2' } })
    const button = screen.getByRole('button', { name: /change password/i })
    expect(button).toBeDisabled()
  })

  it('submit button is enabled when both fields are filled, match, and >= 8 chars', () => {
    render(<ChangePasswordPage />)
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'validpassword' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'validpassword' } })
    const button = screen.getByRole('button', { name: /change password/i })
    expect(button).not.toBeDisabled()
  })

  it('sends refresh token in body (no Authorization header) to POST /api/auth/change-password', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({ message: 'Password updated', token: 'new-token', refreshToken: 'fake-refresh-token' }),
    })

    render(<ChangePasswordPage />)
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'validpassword' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'validpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledOnce()
      expect(global.fetch).toHaveBeenCalledWith(
        '/api/auth/change-password',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({ newPassword: 'validpassword', refreshToken: 'fake-refresh-token' }),
        }),
      )
    })
  })

  it('calls login() with tempPassword: false and tokens from response on success', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        message: 'Password updated',
        token: 'server-issued-token',
        refreshToken: 'fake-refresh-token',
      }),
    })

    render(<ChangePasswordPage />)
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'validpassword' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'validpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith(
        'server-issued-token',
        'fake-refresh-token',
        'test@example.com',
        false,
        false,
      )
    })
  })

  it('calls logout() when change-password returns 401', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: 'Invalid or expired refresh token' }),
    })

    render(<ChangePasswordPage />)
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'validpassword' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'validpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
    })
  })

  it('calls logout() immediately when refresh_token is missing from localStorage', async () => {
    localStorage.removeItem('refresh_token')

    render(<ChangePasswordPage />)
    fireEvent.change(screen.getByLabelText('New Password'), { target: { value: 'validpassword' } })
    fireEvent.change(screen.getByLabelText('Confirm Password'), { target: { value: 'validpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /change password/i }))

    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled()
      expect(global.fetch).not.toHaveBeenCalled()
    })
  })
})
