import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Coach } from '../pages/Coach';
import { Dashboard } from '../pages/Dashboard';
import { FILTER_PRESETS } from '../pages/Dashboard';
import type { WeekBucket } from '../hooks/useDashboard';

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: vi.fn(() => ({
    activeFilter: 'current-plan' as const,
    setActiveFilter: vi.fn(),
    activeDiscipline: 'all' as const,
    setActiveDiscipline: vi.fn(),
    stats: { totalDistance: '0km', totalRuns: 0, totalTime: '0m', adherence: 'N/A', progress: 'N/A' },
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
  })),
  formatPaceToMMSS: (v: number) => String(v),
  parseDurationToMinutes: (_v: string) => 0,
  formatTotalTime: (_v: number) => '0m',
  computeAvgSpeed: (_runs: unknown[]) => '0.0 km/h',
}))

vi.mock('../components/dashboard/DisciplineSelector', () => ({
  DisciplineSelector: () => <div data-testid="discipline-selector" />,
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

// Silence WeekBucket type import — used implicitly in overrides below
const _unused: WeekBucket | null = null; void _unused;

describe('Coach page', () => {
  it('renders heading', () => {
    render(<Coach />);
    expect(screen.getByRole('heading', { name: /coach chat/i })).toBeInTheDocument();
  });
});

describe('Dashboard page', () => {
  it('renders heading', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByRole('heading', { name: /^dashboard$/i })).toBeInTheDocument();
  });

  it('renders all 7 filter preset buttons', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    for (const preset of FILTER_PRESETS) {
      expect(screen.getByText(preset.label)).toBeInTheDocument();
    }
    // Verify all 7 specific labels are present
    expect(screen.getByText('Current Plan')).toBeInTheDocument();
    expect(screen.getByText('Last 4 weeks')).toBeInTheDocument();
    expect(screen.getByText('Last 8 weeks')).toBeInTheDocument();
    expect(screen.getByText('Last 3 months')).toBeInTheDocument();
    expect(screen.getByText('Last 12 months')).toBeInTheDocument();
    expect(screen.getByText('This year')).toBeInTheDocument();
    expect(screen.getByText('All time')).toBeInTheDocument();
  });

  it('renders "No sessions yet" empty state when no data', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    // With no runs in any discipline, shows the global empty state
    expect(screen.getByText('No sessions yet')).toBeInTheDocument();
  });
});
