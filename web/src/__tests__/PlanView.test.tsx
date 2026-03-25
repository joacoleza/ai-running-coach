import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PlanView } from '../components/plan/PlanView';
import type { PlanData } from '../hooks/usePlan';

const plan: PlanData = {
  _id: 'p1',
  status: 'active',
  onboardingMode: 'conversational',
  onboardingStep: 0,
  goal: { eventType: 'marathon', targetDate: '2026-10-01', weeklyMileage: 50, availableDays: 5, units: 'km' },
  phases: [
    {
      name: 'Base Phase',
      description: 'Build your aerobic base',
      weeks: [
        {
          weekNumber: 1,
          startDate: '2026-04-07',
          days: [
            { date: '2026-04-07', type: 'run', guidelines: 'Easy 5k', completed: false, skipped: false },
            { date: '2026-04-08', type: 'rest', guidelines: '', completed: false, skipped: false },
          ],
        },
        {
          weekNumber: 2,
          startDate: '2026-04-14',
          days: [
            { date: '2026-04-14', type: 'run', guidelines: 'Tempo run', completed: false, skipped: false },
          ],
        },
      ],
    },
    {
      name: 'Peak Phase',
      description: '',
      weeks: [],
    },
  ],
};

describe('PlanView', () => {
  it('renders all phase names', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.getByText('Base Phase')).toBeInTheDocument();
    expect(screen.getByText('Peak Phase')).toBeInTheDocument();
  });

  it('renders phase description when present', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.getByText('Build your aerobic base')).toBeInTheDocument();
  });

  it('renders week headings', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.getByText('Week 1')).toBeInTheDocument();
    expect(screen.getByText('Week 2')).toBeInTheDocument();
  });

  it('renders DayRow for each day', () => {
    render(<PlanView plan={plan} onUpdateDay={vi.fn()} onDeleteDay={vi.fn()} />);
    expect(screen.getByText('Easy 5k')).toBeInTheDocument();
    expect(screen.getByText('Rest')).toBeInTheDocument(); // rest days render as "Rest" not guidelines
    expect(screen.getByText('Tempo run')).toBeInTheDocument();
  });
});
