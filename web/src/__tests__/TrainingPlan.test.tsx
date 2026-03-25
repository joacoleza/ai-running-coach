import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TrainingPlan } from '../pages/TrainingPlan';
import type { PlanData } from '../hooks/usePlan';

const mockUpdateDay = vi.fn();
const mockArchivePlan = vi.fn();
const mockImportFromUrl = vi.fn();
const mockStartPlan = vi.fn();

vi.mock('../hooks/usePlan', () => ({
  usePlan: vi.fn(),
}));
vi.mock('../hooks/useChat', () => ({
  useChat: () => ({ startPlan: mockStartPlan }),
}));

import { usePlan } from '../hooks/usePlan';

const mockUsePlan = vi.mocked(usePlan);

function defaultUsePlan(overrides: Partial<ReturnType<typeof usePlan>> = {}) {
  mockUsePlan.mockReturnValue({
    plan: null,
    isLoading: false,
    error: null,
    refreshPlan: vi.fn(),
    updateDay: mockUpdateDay,
    archivePlan: mockArchivePlan,
    importFromUrl: mockImportFromUrl,
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
  mockImportFromUrl.mockReset();
  mockStartPlan.mockReset();
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

  it('shows onboarding message when plan status is onboarding', () => {
    defaultUsePlan({ plan: { ...activePlan, status: 'onboarding', phases: [] } });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    expect(screen.getByText(/complete the onboarding/i)).toBeInTheDocument();
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

  it('clicking New Plan dispatches open-coach event and calls startPlan', () => {
    defaultUsePlan({ plan: null });
    const listener = vi.fn();
    window.addEventListener('open-coach', listener);
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /new plan/i }));
    expect(mockStartPlan).toHaveBeenCalledWith('conversational');
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('open-coach', listener);
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

  it('clicking Import shows ImportUrlForm', () => {
    defaultUsePlan({ plan: null });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /import from chatgpt/i }));
    expect(screen.getByPlaceholderText(/chatgpt.com\/share/i)).toBeInTheDocument();
  });

  it('cancelling import hides the form', () => {
    defaultUsePlan({ plan: null });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /import from chatgpt/i }));
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByPlaceholderText(/chatgpt.com\/share/i)).not.toBeInTheDocument();
  });

  it('archive button triggers confirm and calls archivePlan', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    mockArchivePlan.mockResolvedValue(undefined);
    defaultUsePlan({ plan: activePlan });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /close & archive/i }));
    await waitFor(() => expect(mockArchivePlan).toHaveBeenCalled());
  });
});
