import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { PasswordPage } from '../pages/PasswordPage'

describe('PasswordPage', () => {
  let onSuccess: ReturnType<typeof vi.fn>

  beforeEach(() => {
    onSuccess = vi.fn()
    global.fetch = vi.fn()
    localStorage.clear()
  })

  it('renders a password input with placeholder "Enter password"', () => {
    render(<PasswordPage onSuccess={onSuccess} />)
    expect(screen.getByPlaceholderText('Enter password')).toBeInTheDocument()
  })

  it('renders "Unlock" submit button', () => {
    render(<PasswordPage onSuccess={onSuccess} />)
    expect(screen.getByRole('button', { name: /unlock/i })).toBeInTheDocument()
  })

  it('submit button is disabled when input is empty', () => {
    render(<PasswordPage onSuccess={onSuccess} />)
    const button = screen.getByRole('button', { name: /unlock/i })
    expect(button).toBeDisabled()
  })

  it('on submit with correct password (200): calls onSuccess and sets localStorage', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: true,
      status: 200,
    } as Response)

    render(<PasswordPage onSuccess={onSuccess} />)
    const input = screen.getByPlaceholderText('Enter password')
    fireEvent.change(input, { target: { value: 'secret123' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() => expect(onSuccess).toHaveBeenCalled())
    expect(localStorage.getItem('app_password')).toBe('secret123')
  })

  it('on submit with wrong password (401): shows "Wrong password"', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
    } as Response)

    render(<PasswordPage onSuccess={onSuccess} />)
    const input = screen.getByPlaceholderText('Enter password')
    fireEvent.change(input, { target: { value: 'wrongpass' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() =>
      expect(screen.getByText('Wrong password')).toBeInTheDocument()
    )
  })

  it('on submit with locked service (503): shows "Service locked. Contact administrator."', async () => {
    vi.mocked(global.fetch).mockResolvedValueOnce({
      ok: false,
      status: 503,
    } as Response)

    render(<PasswordPage onSuccess={onSuccess} />)
    const input = screen.getByPlaceholderText('Enter password')
    fireEvent.change(input, { target: { value: 'anypass' } })
    fireEvent.submit(input.closest('form')!)

    await waitFor(() =>
      expect(
        screen.getByText('Service locked. Contact administrator.')
      ).toBeInTheDocument()
    )
  })
})
