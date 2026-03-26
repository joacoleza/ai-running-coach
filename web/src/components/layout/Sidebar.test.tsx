import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Sidebar } from './Sidebar'

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
})
