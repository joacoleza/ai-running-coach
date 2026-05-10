import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { Dashboard } from '../pages/Dashboard';
import { useDashboard, type DisciplineFilter } from '../hooks/useDashboard';
import type { WeekBucket } from '../hooks/useDashboard';

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
  formatPaceToMMSS: (v: number) => String(v),
  parseDurationToMinutes: (_v: string) => 0,
  formatTotalTime: (_v: number) => '0m',
  computeAvgSpeed: (_runs: unknown[]) => '0.0 km/h',
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
vi.mock('../components/dashboard/WeeklySpeedChart', () => ({
  WeeklySpeedChart: () => <div data-testid="weekly-speed-chart" />,
}))
vi.mock('../components/dashboard/WeeklyDurationChart', () => ({
  WeeklyDurationChart: () => <div data-testid="weekly-duration-chart" />,
}))
vi.mock('../components/dashboard/WeightProgressionChart', () => ({
  WeightProgressionChart: () => <div data-testid="weight-progression-chart" />,
}))

const mockUseDashboard = vi.mocked(useDashboard)

const emptyBucket: WeekBucket = {
  weekKey: '2026-04-07',
  weekLabel: 'Apr 7',
  distance: 0,
  avgPace: null,
  totalDurationMinutes: 0,
  hrValues: [],
}

const makeRunRun = (overrides = {}) => ({
  _id: 'run1',
  date: '2026-04-07',
  distance: 15,
  duration: '1:30:00',
  pace: 6.0,
  discipline: 'run' as const,
  createdAt: '2026-04-07',
  updatedAt: '2026-04-07',
  ...overrides,
})

function makeDefaults(overrides: Partial<ReturnType<typeof useDashboard>> = {}): ReturnType<typeof useDashboard> {
  return {
    activeFilter: 'current-plan',
    setActiveFilter: vi.fn(),
    activeDiscipline: 'all' as DisciplineFilter,
    setActiveDiscipline: vi.fn(),
    stats: { totalDistance: '42.5km', totalRuns: 8, totalTime: '3h25m', adherence: '75%', progress: '40%' },
    weeklyData: [],
    multiWeeklyData: [],
    paceData: [],
    paceBpmData: [],
    runs: [],
    runRuns: [],
    cycleRuns: [],
    gymRuns: [],
    runWeeklyBuckets: [],
    cycleWeeklyBuckets: [],
    gymWeeklyBuckets: [],
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

describe('with active plan and run data', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      runRuns: [makeRunRun()],
      runWeeklyBuckets: [{ ...emptyBucket, distance: 15, avgPace: 6.0, totalDurationMinutes: 90 }],
    }))
  })

  it('renders h1 Dashboard', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByRole('heading', { name: /^dashboard$/i })).toBeInTheDocument()
  })

  it('renders Run section header with session count', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Run (1 sessions)')).toBeInTheDocument()
  })

  it('renders Total Runs label', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Total Runs')).toBeInTheDocument()
  })

  it('renders Total Time label in run section', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Total Time')).toBeInTheDocument()
  })

  it('renders Adherence label in run section when activeFilter is current-plan', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Adherence')).toBeInTheDocument()
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('renders Weekly Distance bar chart in run section', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Weekly Distance')).toBeInTheDocument()
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
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

  it('does NOT render discipline sections', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText(/Run \(/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Cycling \(/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Gym \(/)).not.toBeInTheDocument()
  })
})

describe('empty state - has plan but no sessions in range', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      activeFilter: 'last-4-weeks',
      activeDiscipline: 'all' as DisciplineFilter,
      hasPlan: true,
      isLoading: false,
      runRuns: [],
      cycleRuns: [],
      gymRuns: [],
    }))
  })

  it('renders "No sessions yet" when all discipline sections are hidden', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('No sessions yet')).toBeInTheDocument()
  })

  it('does NOT render section headers when no data', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText(/Run \(/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Cycling \(/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Gym \(/)).not.toBeInTheDocument()
  })
})

describe('loading state', () => {
  beforeEach(() => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      isLoading: true,
    }))
  })

  it('renders loading spinner (svg with animate-spin)', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    const svg = document.querySelector('svg.animate-spin')
    expect(svg).toBeInTheDocument()
  })

  it('does NOT render discipline sections while loading', () => {
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText(/Run \(/)).not.toBeInTheDocument()
  })
})

describe('adherence card guard', () => {
  it('shows Adherence card in run section when activeFilter is current-plan', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      activeFilter: 'current-plan',
      runRuns: [makeRunRun()],
      runWeeklyBuckets: [emptyBucket],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Adherence')).toBeInTheDocument()
  })

  it('hides Adherence card when activeFilter is last-4-weeks', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      activeFilter: 'last-4-weeks',
      runRuns: [makeRunRun()],
      runWeeklyBuckets: [emptyBucket],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText('Adherence')).not.toBeInTheDocument()
  })
})

describe('Weekly Avg Pace chart', () => {
  it('renders pace chart when runWeeklyBuckets has avgPace data', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      runRuns: [makeRunRun()],
      runWeeklyBuckets: [{ ...emptyBucket, avgPace: 6.0, distance: 15, totalDurationMinutes: 90 }],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Weekly Avg Pace')).toBeInTheDocument()
  })

  it('does NOT render pace chart when no avgPace data', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      runRuns: [makeRunRun()],
      runWeeklyBuckets: [{ ...emptyBucket, avgPace: null }],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText('Weekly Avg Pace')).not.toBeInTheDocument()
  })
})

describe('Weekly Avg Pace vs Heart Rate ComposedChart', () => {
  it('renders ComposedChart when runWeeklyBuckets has avgPace and hrValues data', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      runRuns: [makeRunRun()],
      runWeeklyBuckets: [{ ...emptyBucket, avgPace: 5.2, hrValues: [145], distance: 15, totalDurationMinutes: 90 }],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Weekly Avg Pace vs Heart Rate')).toBeInTheDocument()
    expect(screen.getByTestId('composed-chart')).toBeInTheDocument()
  })

  it('does NOT render ComposedChart when no pace or HR data', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      runRuns: [],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText('Weekly Avg Pace vs Heart Rate')).not.toBeInTheDocument()
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

describe('Cycling section', () => {
  it('renders Cycling section header when cycleRuns exist', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      cycleRuns: [{ _id: 'c1', date: '2026-04-07', distance: 25, duration: '1:00:00', pace: 0, discipline: 'cycle', createdAt: '', updatedAt: '' }],
      cycleWeeklyBuckets: [emptyBucket],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Cycling (1 sessions)')).toBeInTheDocument()
  })

  it('renders WeeklySpeedChart in cycling section', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      cycleRuns: [{ _id: 'c1', date: '2026-04-07', distance: 25, duration: '1:00:00', pace: 0, discipline: 'cycle', createdAt: '', updatedAt: '' }],
      cycleWeeklyBuckets: [{ ...emptyBucket, distance: 25, totalDurationMinutes: 60 }],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Weekly Avg Speed')).toBeInTheDocument()
    expect(screen.getByTestId('weekly-speed-chart')).toBeInTheDocument()
  })

  it('does NOT render Cycling section when no cycleRuns and discipline is "all"', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      cycleRuns: [],
      activeDiscipline: 'all',
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText(/Cycling \(/)).not.toBeInTheDocument()
  })

  it('renders Cycling empty state when discipline is "cycle" but no cycleRuns', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      cycleRuns: [],
      activeDiscipline: 'cycle',
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Cycling (0 sessions)')).toBeInTheDocument()
    expect(screen.getByText('No cycling sessions in selected period')).toBeInTheDocument()
  })
})

describe('Gym section', () => {
  it('renders Gym section header when gymRuns exist', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      gymRuns: [{ _id: 'g1', date: '2026-04-07', distance: 0, duration: '45:00', pace: 0, discipline: 'gym', createdAt: '', updatedAt: '' }],
      gymWeeklyBuckets: [emptyBucket],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Gym (1 sessions)')).toBeInTheDocument()
  })

  it('renders Total Sessions label when gym discipline', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      gymRuns: [{ _id: 'g1', date: '2026-04-07', distance: 0, duration: '45:00', pace: 0, discipline: 'gym', createdAt: '', updatedAt: '' }],
      gymWeeklyBuckets: [emptyBucket],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Total Sessions')).toBeInTheDocument()
  })

  it('renders WeeklyDurationChart in gym section', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      gymRuns: [{ _id: 'g1', date: '2026-04-07', distance: 0, duration: '45:00', pace: 0, discipline: 'gym', createdAt: '', updatedAt: '' }],
      gymWeeklyBuckets: [{ ...emptyBucket, totalDurationMinutes: 45 }],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Weekly Duration')).toBeInTheDocument()
    expect(screen.getByTestId('weekly-duration-chart')).toBeInTheDocument()
  })

  it('renders WeightProgressionChart in gym section', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      gymRuns: [{ _id: 'g1', date: '2026-04-07', distance: 0, duration: '45:00', pace: 0, discipline: 'gym', createdAt: '', updatedAt: '' }],
      gymWeeklyBuckets: [emptyBucket],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByTestId('weight-progression-chart')).toBeInTheDocument()
  })

  it('does NOT render Gym section when no gymRuns and discipline is "all"', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      gymRuns: [],
      activeDiscipline: 'all',
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText(/Gym \(/)).not.toBeInTheDocument()
  })

  it('renders Gym empty state when discipline is "gym" but no gymRuns', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      gymRuns: [],
      activeDiscipline: 'gym',
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.getByText('Gym (0 sessions)')).toBeInTheDocument()
    expect(screen.getByText('No gym sessions in selected period')).toBeInTheDocument()
  })
})

describe('section visibility with activeDiscipline filter', () => {
  it('shows only Run section when activeDiscipline is "run"', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      activeDiscipline: 'run',
      runRuns: [makeRunRun()],
      runWeeklyBuckets: [emptyBucket],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText(/Cycling \(/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Gym \(/)).not.toBeInTheDocument()
  })

  it('shows only Gym section when activeDiscipline is "gym"', () => {
    mockUseDashboard.mockReturnValue(makeDefaults({
      activeDiscipline: 'gym',
      gymRuns: [{ _id: 'g1', date: '2026-04-07', distance: 0, duration: '45:00', pace: 0, discipline: 'gym', createdAt: '', updatedAt: '' }],
      gymWeeklyBuckets: [emptyBucket],
    }))
    render(<MemoryRouter><Dashboard /></MemoryRouter>)
    expect(screen.queryByText(/Run \(/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Cycling \(/)).not.toBeInTheDocument()
    expect(screen.getByText('Gym (1 sessions)')).toBeInTheDocument()
  })
})
