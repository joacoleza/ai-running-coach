import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'

vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'fake-token',
    logout: vi.fn(),
    email: 'test@example.com',
    isAdmin: false,
  }),
}))

describe('Sidebar', () => {
  it('renders three navigation links (coach is now a persistent panel, not a nav link)', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Training Plan')).toBeInTheDocument()
    expect(screen.getByText('Runs')).toBeInTheDocument()
    expect(screen.queryByText('Coach Chat')).not.toBeInTheDocument()
  })

  it('has navigation role', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument()
  })

  it('renders sidebar container with data-testid', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
  })

  it('renders Dashboard link before Training Plan link', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    const links = screen.getAllByRole('link')
    const dashboardIndex = links.findIndex((link) => link.textContent?.includes('Dashboard'))
    const trainingPlanIndex = links.findIndex((link) => link.textContent?.includes('Training Plan'))
    expect(dashboardIndex).toBeGreaterThanOrEqual(0)
    expect(trainingPlanIndex).toBeGreaterThanOrEqual(0)
    expect(dashboardIndex).toBeLessThan(trainingPlanIndex)
  })

  it('logout button appears after clicking header row', async () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    )
    // Logout is hidden until the header row is clicked
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /account menu/i }))
    expect(screen.getByRole('button', { name: /logout/i })).toBeInTheDocument()
  })
})
