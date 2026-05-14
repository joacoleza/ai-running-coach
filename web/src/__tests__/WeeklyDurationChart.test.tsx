import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { WeeklyDurationChart } from '../components/dashboard/WeeklyDurationChart';
import type { DurationDataPoint } from '../components/dashboard/WeeklyDurationChart';

vi.mock('recharts', () => ({
  BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const twoWeeks: DurationDataPoint[] = [
  { weekLabel: 'Apr 6', durationMinutes: 90 },
  { weekLabel: 'Apr 13', durationMinutes: 60 },
]

describe('WeeklyDurationChart', () => {
  it('renders "No gym sessions yet" when data is empty', () => {
    render(<WeeklyDurationChart data={[]} />)
    expect(screen.getByText('No gym sessions yet')).toBeInTheDocument()
  })

  it('renders BarChart when data is non-empty', () => {
    render(<WeeklyDurationChart data={twoWeeks} />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('renders without crashing for a single data point', () => {
    render(<WeeklyDurationChart data={[{ weekLabel: 'Apr 6', durationMinutes: 45 }]} />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })

  it('renders without crashing for zero-duration weeks', () => {
    const zeroData: DurationDataPoint[] = [
      { weekLabel: 'Apr 6', durationMinutes: 0 },
    ]
    render(<WeeklyDurationChart data={zeroData} />)
    expect(screen.getByTestId('bar-chart')).toBeInTheDocument()
  })
})
