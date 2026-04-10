import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Coach } from '../pages/Coach';
import { Dashboard } from '../pages/Dashboard';
import { FILTER_PRESETS } from '../pages/Dashboard';

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: vi.fn(() => ({
    activeFilter: 'current-plan' as const,
    setActiveFilter: vi.fn(),
    stats: { totalDistance: '0km', totalRuns: 0, totalTime: '0m', adherence: 'N/A' },
    weeklyData: [],
    paceData: [],
    isLoading: false,
    hasPlan: true,
  })),
}))

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

  it('renders stat card labels', () => {
    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    );
    expect(screen.getByText('Total Distance')).toBeInTheDocument();
    expect(screen.getByText('Total Runs')).toBeInTheDocument();
    expect(screen.getByText('Total Time')).toBeInTheDocument();
    expect(screen.getByText('Adherence')).toBeInTheDocument();
  });
});
