/**
 * AUTH-03: LoginPage component error states and form behavior tests
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { LoginPage } from '../pages/LoginPage'

// Mock AuthContext — LoginPage calls useAuth()
const mockLogin = vi.fn()
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: null,
    email: null,
    isAdmin: false,
    tempPassword: false,
    login: mockLogin,
    logout: vi.fn(),
  }),
}))

const mockOnTempPassword = vi.fn()

describe('LoginPage form behavior and error states', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    global.fetch = vi.fn()
  })

  it('submit button is disabled when both email and password are empty', () => {
    render(<LoginPage onTempPassword={mockOnTempPassword} />)
    const button = screen.getByRole('button', { name: /log in/i })
    expect(button).toBeDisabled()
  })

  it('submit button is disabled when email is empty and password is filled', () => {
    render(<LoginPage onTempPassword={mockOnTempPassword} />)
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    const button = screen.getByRole('button', { name: /log in/i })
    expect(button).toBeDisabled()
  })

  it('submit button is disabled when password is empty and email is filled', () => {
    render(<LoginPage onTempPassword={mockOnTempPassword} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    const button = screen.getByRole('button', { name: /log in/i })
    expect(button).toBeDisabled()
  })

  it('submit button is enabled when both email and password have content', () => {
    render(<LoginPage onTempPassword={mockOnTempPassword} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    const button = screen.getByRole('button', { name: /log in/i })
    expect(button).not.toBeDisabled()
  })

  it('shows "Invalid email or password" on 401 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: vi.fn().mockResolvedValue({ error: 'Invalid credentials' }),
    })

    render(<LoginPage onTempPassword={mockOnTempPassword} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'wrong@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument()
    })
  })

  it('shows "Service locked. Contact administrator." on 503 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
    })

    render(<LoginPage onTempPassword={mockOnTempPassword} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByText('Service locked. Contact administrator.')).toBeInTheDocument()
    })
  })

  it('shows "Network error — please try again" on network failure (fetch throws)', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'))

    render(<LoginPage onTempPassword={mockOnTempPassword} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByText('Network error \u2014 please try again')).toBeInTheDocument()
    })
  })

  it('shows "Network error — please try again" on unexpected non-401/503 status', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    render(<LoginPage onTempPassword={mockOnTempPassword} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(screen.getByText('Network error \u2014 please try again')).toBeInTheDocument()
    })
  })

  it('calls login() with tempPassword: false after successful login for normal user', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        token: 'jwt-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        tempPassword: false,
      }),
    })

    render(<LoginPage onTempPassword={mockOnTempPassword} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('jwt-token', 'refresh-token', 'user@example.com', false, false)
    })
    expect(mockOnTempPassword).not.toHaveBeenCalled()
  })

  it('shows lockout message from API body on 429 response', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: vi.fn().mockResolvedValue({ error: 'Too many failed attempts. Try again in 15 minutes.' }),
    })
    render(<LoginPage onTempPassword={mockOnTempPassword} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))
    await waitFor(() => {
      expect(screen.getByText('Too many failed attempts. Try again in 15 minutes.')).toBeInTheDocument()
    })
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('shows fallback lockout message on 429 with no error body', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 429,
      json: vi.fn().mockResolvedValue({}),
    })
    render(<LoginPage onTempPassword={mockOnTempPassword} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'user@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpassword' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))
    await waitFor(() => {
      expect(screen.getByText('Account locked. Try again later.')).toBeInTheDocument()
    })
  })

  it('calls onTempPassword() after login when response includes tempPassword: true', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: vi.fn().mockResolvedValue({
        token: 'jwt-token',
        refreshToken: 'refresh-token',
        expiresIn: 900,
        tempPassword: true,
      }),
    })

    render(<LoginPage onTempPassword={mockOnTempPassword} />)
    fireEvent.change(screen.getByLabelText('Email'), { target: { value: 'temp@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'password123' } })
    fireEvent.click(screen.getByRole('button', { name: /log in/i }))

    await waitFor(() => {
      expect(mockOnTempPassword).toHaveBeenCalled()
    })
    expect(mockLogin).toHaveBeenCalledWith('jwt-token', 'refresh-token', 'temp@example.com', false, true)
  })
})
