import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TrainingPlan } from '../pages/TrainingPlan';
import type { PlanData } from '../hooks/usePlan';

const mockUpdateDay = vi.fn();
const mockArchivePlan = vi.fn();

vi.mock('../hooks/usePlan', () => ({
  usePlan: vi.fn(),
}));

import { usePlan } from '../hooks/usePlan';

const mockUsePlan = vi.mocked(usePlan);

function defaultUsePlan(overrides: Partial<ReturnType<typeof usePlan>> = {}) {
  mockUsePlan.mockReturnValue({
    plan: null,
    isLoading: false,
    error: null,
    refreshPlan: vi.fn().mockResolvedValue(undefined),
    updateDay: mockUpdateDay,
    deleteDay: vi.fn(),
    addDay: vi.fn(),
    archivePlan: mockArchivePlan,
    ...overrides,
  });
}

const activePlan: PlanData = {
  _id: 'p1',
  status: 'active',
  onboardingMode: 'conversational',
  onboardingStep: 0,
  goal: { eventType: 'marathon', targetDate: '2026-10-01', weeklyMileage: 50, availableDays: 5, units: 'km' },
  objective: 'marathon',
  targetDate: '2026-10-01',
  phases: [
    {
      name: 'Base',
      description: 'Aerobic base',
      weeks: [
        {
          weekNumber: 1,
          startDate: '2026-04-07',
          days: [
            { date: '2026-04-07', type: 'run', guidelines: 'Easy run', completed: false, skipped: false },
          ],
        },
      ],
    },
  ],
};

beforeEach(() => {
  mockUpdateDay.mockReset();
  mockArchivePlan.mockReset();
});

describe('TrainingPlan', () => {
  it('shows loading state', () => {
    defaultUsePlan({ isLoading: true });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    expect(screen.getByText('Loading plan...')).toBeInTheDocument();
  });

  it('shows no-plan message when plan is null', () => {
    defaultUsePlan({ plan: null });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    expect(screen.getByText(/no active plan/i)).toBeInTheDocument();
  });

  it('shows no New Plan button — that action lives in the coach chat', () => {
    defaultUsePlan({ plan: null });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /new plan/i })).not.toBeInTheDocument();
  });

  it('shows onboarding message when plan status is onboarding', () => {
    defaultUsePlan({ plan: { ...activePlan, status: 'onboarding', phases: [] } });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    expect(screen.getByText(/complete the onboarding/i)).toBeInTheDocument();
  });

  it('shows no buttons when plan is onboarding', () => {
    defaultUsePlan({ plan: { ...activePlan, status: 'onboarding', phases: [] } });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    expect(screen.queryByRole('button', { name: /new plan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue planning/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /update plan/i })).not.toBeInTheDocument();
  });

  it('renders plan view with active plan', () => {
    defaultUsePlan({ plan: activePlan });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('marathon')).toBeInTheDocument();
  });

  it('shows error banner when error is set', () => {
    defaultUsePlan({ plan: null, error: 'Something went wrong' });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('clicking Update Plan dispatches open-coach event', () => {
    defaultUsePlan({ plan: activePlan });
    const listener = vi.fn();
    window.addEventListener('open-coach', listener);
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /update plan/i }));
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('open-coach', listener);
  });

  it('archive button triggers confirm and calls archivePlan', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    mockArchivePlan.mockResolvedValue(undefined);
    defaultUsePlan({ plan: activePlan });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /close & archive/i }));
    await waitFor(() => expect(mockArchivePlan).toHaveBeenCalled());
  });

  it('goal banner shows objective and target date', () => {
    defaultUsePlan({ plan: activePlan });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    expect(screen.getByText('marathon')).toBeInTheDocument();
    expect(screen.getByText('Target: 2026-10-01')).toBeInTheDocument();
  });

  it('goal banner container uses flex-wrap so target can break to second line', () => {
    defaultUsePlan({ plan: activePlan });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    const objectiveEl = screen.getByText('marathon');
    const targetEl = screen.getByText('Target: 2026-10-01');
    // Both are direct children of the same flex-wrap container
    const container = objectiveEl.parentElement!;
    expect(container).toBe(targetEl.parentElement);
    expect(container.className).toContain('flex');
    expect(container.className).toContain('flex-wrap');
  });

  it('goal banner objective and target are sibling elements, not nested', () => {
    defaultUsePlan({ plan: activePlan });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    const objectiveEl = screen.getByText('marathon');
    const targetEl = screen.getByText('Target: 2026-10-01');
    // Neither is a descendant of the other
    expect(objectiveEl.contains(targetEl)).toBe(false);
    expect(targetEl.contains(objectiveEl)).toBe(false);
  });

  it('goal banner does not render target when targetDate is absent', () => {
    const planNoTarget = { ...activePlan, targetDate: undefined };
    defaultUsePlan({ plan: planNoTarget });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    expect(screen.queryByText(/Target:/)).not.toBeInTheDocument();
  });
});
