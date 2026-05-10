import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { WeeklySpeedChart } from '../components/dashboard/WeeklySpeedChart';
import type { SpeedDataPoint } from '../components/dashboard/WeeklySpeedChart';

vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

const twoWeeks: SpeedDataPoint[] = [
  { weekLabel: 'Apr 6', speed: 20.5 },
  { weekLabel: 'Apr 13', speed: 22.0 },
]

describe('WeeklySpeedChart', () => {
  it('renders "No cycling sessions yet" when data is empty', () => {
    render(<WeeklySpeedChart data={[]} />)
    expect(screen.getByText('No cycling sessions yet')).toBeInTheDocument()
  })

  it('renders "No cycling sessions yet" when all speed values are null', () => {
    const nullData: SpeedDataPoint[] = [
      { weekLabel: 'Apr 6', speed: null },
      { weekLabel: 'Apr 13', speed: null },
    ]
    render(<WeeklySpeedChart data={nullData} />)
    expect(screen.getByText('No cycling sessions yet')).toBeInTheDocument()
  })

  it('renders LineChart when data has at least one non-null speed value', () => {
    render(<WeeklySpeedChart data={twoWeeks} />)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('renders without crashing for a single data point with speed', () => {
    render(<WeeklySpeedChart data={[{ weekLabel: 'Apr 6', speed: 18.0 }]} />)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })

  it('renders without crashing for mixed null and non-null speed values', () => {
    const mixed: SpeedDataPoint[] = [
      { weekLabel: 'Apr 6', speed: null },
      { weekLabel: 'Apr 13', speed: 20.0 },
    ]
    render(<WeeklySpeedChart data={mixed} />)
    expect(screen.getByTestId('line-chart')).toBeInTheDocument()
  })
})
