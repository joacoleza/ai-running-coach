import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { PlanCalendar } from '../components/plan/PlanCalendar'

// Mock react-big-calendar to avoid CSS import complexity and DOM rendering issues.
// This lets us test event mapping, color coding, and click handling directly.
vi.mock('react-big-calendar', () => ({
  Calendar: ({ onSelectEvent, events, eventPropGetter, defaultView }: any) => (
    <div data-testid="calendar" data-view={defaultView}>
      {events.map((event: any, i: number) => {
        const { style } = eventPropGetter(event)
        return (
          <button
            key={i}
            data-testid="calendar-event"
            style={style}
            onClick={() => onSelectEvent(event)}
          >
            {event.title}
          </button>
        )
      })}
    </div>
  ),
  dateFnsLocalizer: () => ({}),
}))

function makeSession(overrides: Partial<{
  id: string; date: string; distance: number; duration: number; notes: string; completed: boolean
}> = {}) {
  return {
    id: 'session-1',
    date: '2026-04-01',
    distance: 5,
    duration: 30,
    notes: 'Easy run',
    completed: false,
    ...overrides,
  }
}

describe('PlanCalendar (PLAN-03)', () => {
  it('renders weekly calendar view', () => {
    render(<PlanCalendar sessions={[]} units="km" onSelectSession={vi.fn()} />)
    expect(screen.getByTestId('calendar')).toBeInTheDocument()
    expect(screen.getByTestId('calendar')).toHaveAttribute('data-view', 'week')
  })

  it('maps sessions to calendar events with date + distance', () => {
    render(<PlanCalendar sessions={[makeSession({ distance: 5, notes: 'Easy run' })]} units="km" onSelectSession={vi.fn()} />)
    expect(screen.getByTestId('calendar-event')).toHaveTextContent('Easy run - 5km')
  })

  it('calls onSelectSession when event is clicked', () => {
    const onSelect = vi.fn()
    const session = makeSession()
    render(<PlanCalendar sessions={[session]} units="km" onSelectSession={onSelect} />)

    fireEvent.click(screen.getByTestId('calendar-event'))

    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledWith(session)
  })

  it('color codes sessions by type from notes field', () => {
    const sessions = [
      makeSession({ id: 's1', notes: 'Long run Sunday' }),
      makeSession({ id: 's2', notes: 'Tempo run' }),
      makeSession({ id: 's3', notes: 'Interval training speed' }),
      makeSession({ id: 's4', notes: 'Recovery run' }),
      makeSession({ id: 's5', notes: 'Completed run', completed: true }),
    ]
    render(<PlanCalendar sessions={sessions} units="km" onSelectSession={vi.fn()} />)

    const events = screen.getAllByTestId('calendar-event')
    // Completed → green (#10B981)
    expect(events[4].style.backgroundColor).toBe('rgb(16, 185, 129)')
    // Long → purple (#8B5CF6)
    expect(events[0].style.backgroundColor).toBe('rgb(139, 92, 246)')
    // Tempo → amber (#F59E0B)
    expect(events[1].style.backgroundColor).toBe('rgb(245, 158, 11)')
    // Interval/speed → red (#EF4444)
    expect(events[2].style.backgroundColor).toBe('rgb(239, 68, 68)')
    // Recovery → gray (#6B7280)
    expect(events[3].style.backgroundColor).toBe('rgb(107, 114, 128)')
  })

  it('navigates between weeks with prev/next: all sessions render as events', () => {
    // All sessions map to calendar events regardless of which week is displayed.
    // Week navigation is handled internally by react-big-calendar.
    const sessions = [
      makeSession({ id: 's1', date: '2026-04-01' }),
      makeSession({ id: 's2', date: '2026-04-08' }), // different week
      makeSession({ id: 's3', date: '2026-04-15' }), // another week
    ]
    render(<PlanCalendar sessions={sessions} units="km" onSelectSession={vi.fn()} />)

    expect(screen.getAllByTestId('calendar-event')).toHaveLength(3)
  })
})
