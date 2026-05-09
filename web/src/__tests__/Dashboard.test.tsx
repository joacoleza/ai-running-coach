import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { Dashboard } from '../pages/Dashboard';
import { useDashboard, type DisciplineFilter } from '../hooks/useDashboard';

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
  formatPaceToMMSS: (v: number) => String(v),
}))

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importActual) => {
  const actual = await importActual<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  ComposedChart: ({ children }: { children: React.ReactNode }) => <div data-testid="composed-chart">{children}</div>,
  Bar: () => null,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  Legend: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

vi.mock('../components/dashboard/DisciplineSelector', () => ({
  DisciplineSelector: ({ activeDiscipline, onChange }: { activeDiscipline: DisciplineFilter; onChange: (d: DisciplineFilter) => void }) => (
    <div data-testid="discipline-selector">
      <button onClick={() => onChange('gym')}>Gym</button>
      <button onClick={() => onChange('run')}>Run</button>
      <button onClick={() => onChange('all')}>All</button>
      <button onClick={() => onChange('cycle')}>Cycle</button>
      <span data-testid="active-discipline">{activeDiscipline}</span>
    </div>
  ),
}))
vi.mock('../components/dashboard/WeeklyVolumeChart', () => ({
  WeeklyVolumeChart: () => <div data-testid="weekly-volume-chart" />,
}))
vi.mock('../components/dashboard/WeightProgressionChart', () => ({
  WeightProgressionChart: () => <div data-testid="weight-progression-chart" />,
}))

const mockUseDashboard = vi.mocked(useDashboard)

function makeDefaults(overrides: Partial<ReturnType<typeof useDashboard>> = {}): ReturnType<typeof useDashboard> {
  return {
    activeFilter: 'current-plan',
    setActiveFilter: vi.fn(),
    activeDiscipline: 'all' as DisciplineFilter,
    setActiveDiscipline: vi.fn(),
    stats: { totalDistance: '42.5km', totalRuns: 8, totalTime: '3h25m', adherence: '75%', progress: '40%' },
    weeklyData: [{ weekLabel: 'Apr 7', distance: 15 }],
    multiWeeklyData: [],
    paceData: [{ weekLabel: 'Apr 7', pace: 5.2 }],
    paceBpmData: [],
    runs: [],
    isLoading: false,
    isPlanLoading: false,
    hasPlan: true,
    ...overrides,
  }
}

beforeEach(() => {
  mockNavigate.mockClear()
  mockUseDashboard.mockReturnValue(makeDefaults())
})

describe('with active plan and data', () => {
  it('renders h1 Dashboard', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /^dashboard$/i })).toBeInTheDocument()
  })

  it('renders Total Distance label and value', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Total Distance')).toBeInTheDocument()
    expect(screen.getByText('42.5km')).toBeInTheDocument()
  })

  it('renders Total Runs label and value', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Total Runs')).toBeInTheDocument()
    expect(screen.getByText('8')).toBeInTheDocument()
  })

  it('renders Total Time label and value', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Total Time')).toBeInTheDocument()
    expect(screen.getByText('3h25m')).toBeInTheDocument()
  })

  it('renders Adherence label and value', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Adherence')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders Weekly Volume chart section', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Weekly Volume')).toBeInTheDocument()
    expect(screen.getByTestId('weekly-volume-chart')).toBeInTheDocument()
  })

  it('renders Weekly Avg Pace chart section', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Weekly Avg Pace')).toBeInTheDocument()
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('navigates to /plan when Adherence card is clicked', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    const adherenceCard = screen.getByText('75%').closest('[role="button"]')!
    fireEvent.click(adherenceCard)
    expect(mockNavigate).toHaveBeenCalledWith('/plan')
  })
})

describe('empty state - no active plan', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      activeFilter: 'current-plan',
      hasPlan: false,
      isLoading: false,
      weeklyData: [],
      paceData: [],
      stats: { totalDistance: '0km', totalRuns: 0, totalTime: '0m', adherence: 'N/A', progress: 'N/A' },
    }))
  })

  it('renders "No active training plan" empty state text', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('No active training plan')).toBeInTheDocument()
  })

  it('renders "Start Planning" button', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByRole('button', { name: /start planning/i })).toBeInTheDocument()
  })

  it('does NOT render Weekly Volume chart section', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText('Weekly Volume')).not.toBeInTheDocument()
  })
})

describe('empty state - has plan but no runs', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      activeFilter: 'last-4-weeks',
      activeDiscipline: 'all' as DisciplineFilter,
      hasPlan: true,
      isLoading: false,
      weeklyData: [],
      paceData: [],
      runs: [],
      stats: { totalDistance: '0km', totalRuns: 0, totalTime: '0m', adherence: 'N/A', progress: 'N/A' },
    }))
  })

  it('renders "No runs yet" empty state text', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('No runs yet')).toBeInTheDocument()
  })

  it('does NOT render Weekly Volume chart section', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText('Weekly Volume')).not.toBeInTheDocument()
  })

  it('shows stat cards (not no-plan empty state)', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Total Distance')).toBeInTheDocument()
    expect(screen.queryByText('No active training plan')).not.toBeInTheDocument()
  })
})

describe('loading state', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      isLoading: true,
      weeklyData: [],
      paceData: [],
    }))
  })

  it('renders loading spinner (svg with animate-spin)', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    const svg = document.querySelector('svg.animate-spin')
    expect(svg).toBeInTheDocument()
  })

  it('shows "—" placeholders for stat values while loading', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(3)
  })
})

describe('adherence card guard', () => {
  it('shows Adherence card when activeFilter is current-plan', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({ activeFilter: 'current-plan' }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Adherence')).toBeInTheDocument()
  })

  it('hides Adherence card when activeFilter is last-4-weeks', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({ activeFilter: 'last-4-weeks' }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText('Adherence')).not.toBeInTheDocument()
  })

  it('hides Adherence card when activeFilter is all-time', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({ activeFilter: 'all-time' }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText('Adherence')).not.toBeInTheDocument()
  })
})

describe('Weekly Avg Pace vs Heart Rate ComposedChart', () => {
  it('renders ComposedChart when paceBpmData has entries with data', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      paceBpmData: [{ weekLabel: 'Apr 7', pace: 5.2, avgBPM: 145 }],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Weekly Avg Pace vs Heart Rate')).toBeInTheDocument()
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument()
  })

  it('does NOT render ComposedChart when paceBpmData has no actual data', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({ paceBpmData: [] }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText('Weekly Avg Pace vs Heart Rate')).not.toBeInTheDocument()
    expect(screen.queryByTestId('composed-chart')).not.toBeInTheDocument()
  })
})

describe('DisciplineSelector integration', () => {
  it('renders DisciplineSelector component', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByTestId('discipline-selector')).toBeInTheDocument()
  })

  it('activeDiscipline defaults to "all"', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByTestId('active-discipline').textContent).toBe('all')
  })
})

describe('Gym discipline stat cards', () => {
  it('renders Total Sessions label and value when activeDiscipline is gym', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      activeDiscipline: 'gym' as DisciplineFilter,
      stats: {
        totalDistance: '0km',
        totalRuns: 0,
        totalTime: '0m',
        adherence: '75%',
        progress: '40%',
        totalSessions: 5,
        totalDuration: '2h30m',
      },
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Total Sessions')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders Total Duration label and value when activeDiscipline is gym', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      activeDiscipline: 'gym' as DisciplineFilter,
      stats: {
        totalDistance: '0km',
        totalRuns: 0,
        totalTime: '0m',
        adherence: '75%',
        progress: '40%',
        totalSessions: 5,
        totalDuration: '2h30m',
      },
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Total Duration')).toBeInTheDocument()
    expect(screen.getByText('2h30m')).toBeInTheDocument()
  })

  it('does NOT render Total Runs label when activeDiscipline is gym', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      activeDiscipline: 'gym' as DisciplineFilter,
      stats: {
        totalDistance: '0km',
        totalRuns: 0,
        totalTime: '0m',
        adherence: '75%',
        progress: '40%',
        totalSessions: 5,
        totalDuration: '2h30m',
      },
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText('Total Runs')).not.toBeInTheDocument()
  })
})

describe('Cycle discipline stat cards', () => {
  it('renders Total Speed label and value when activeDiscipline is cycle', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      activeDiscipline: 'cycle' as DisciplineFilter,
      stats: {
        totalDistance: '120.0km',
        totalRuns: 0,
        totalTime: '6h0m',
        adherence: '75%',
        progress: '40%',
        avgSpeed: '18.5 km/h',
      },
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Total Speed')).toBeInTheDocument()
    expect(screen.getByText('18.5 km/h')).toBeInTheDocument()
  })

  it('does NOT render Total Runs label when activeDiscipline is cycle', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      activeDiscipline: 'cycle' as DisciplineFilter,
      stats: {
        totalDistance: '120.0km',
        totalRuns: 0,
        totalTime: '6h0m',
        adherence: '75%',
        progress: '40%',
        avgSpeed: '18.5 km/h',
      },
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText('Total Runs')).not.toBeInTheDocument()
  })
})

describe('WeightProgressionChart visibility', () => {
  it('renders WeightProgressionChart when runs includes a gym session', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      weeklyData: [{ weekLabel: 'Apr 7', distance: 0 }],
      runs: [{ _id: 'run1', date: '2026-04-07', distance: 0, duration: '45:00', pace: 0, discipline: 'gym', exercises: [] }],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByTestId('weight-progression-chart')).toBeInTheDocument()
  })

  it('does NOT render WeightProgressionChart when runs array is empty', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      runs: [],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByTestId('weight-progression-chart')).not.toBeInTheDocument()
  })
})

describe('WeeklyVolumeChart renders', () => {
  it('renders WeeklyVolumeChart when weeklyData is not empty', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByTestId('weekly-volume-chart')).toBeInTheDocument()
  })
})
