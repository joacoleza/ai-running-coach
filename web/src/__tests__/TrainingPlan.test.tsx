import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TrainingPlan } from '../pages/TrainingPlan';
import type { PlanData } from '../hooks/usePlan';

const mockUpdateDay = vi.fn();
const mockArchivePlan = vi.fn();

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'test-token',
    logout: vi.fn(),
    email: 'test@example.com',
    isAdmin: false,
    tempPassword: false,
    login: vi.fn(),
  }),
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: vi.fn(),
}));

vi.mock('../contexts/ChatContext', () => ({
  useChatContext: vi.fn(() => ({
    sendMessage: vi.fn().mockResolvedValue(''),
    messages: [],
    plan: null,
    isStreaming: false,
    isGeneratingPlan: false,
    isLoading: false,
    isBusy: false,
    error: null,
    startPlan: vi.fn(),
    startOver: vi.fn(),
    clearError: vi.fn(),
  })),
}));

import { usePlan } from '../hooks/usePlan';
import { useChatContext } from '../contexts/ChatContext';

const mockUsePlan = vi.mocked(usePlan);

function defaultUsePlan(overrides: Partial<ReturnType<typeof usePlan>> = {}) {
  mockUsePlan.mockReturnValue({
    plan: null,
    linkedRuns: new Map(),
    isLoading: false,
    error: null,
    refreshPlan: vi.fn().mockResolvedValue(undefined),
    updateDay: mockUpdateDay,
    deleteDay: vi.fn(),
    addDay: vi.fn(),
    archivePlan: mockArchivePlan,
    updatePhase: vi.fn().mockResolvedValue(undefined),
    deleteLastPhase: vi.fn().mockResolvedValue(undefined),
    addPhase: vi.fn().mockResolvedValue(undefined),
    addWeek: vi.fn().mockResolvedValue(undefined),
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
          days: [
            { label: 'A', type: 'run', guidelines: 'Easy run', completed: false, skipped: false },
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

  it('archive button triggers confirm and calls archivePlan', async () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    mockArchivePlan.mockResolvedValue(undefined);
    defaultUsePlan({ plan: activePlan });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /^archive$/i }));
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

  it('shows "+ Set target date" prompt when plan has no targetDate', () => {
    const planNoDate = { ...activePlan, targetDate: undefined };
    defaultUsePlan({ plan: planNoDate });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    expect(screen.getByText('+ Set target date')).toBeInTheDocument();
  });

  it('clicking target date text enters edit mode and shows a date input', () => {
    defaultUsePlan({ plan: activePlan });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    fireEvent.click(screen.getByText('Target: 2026-10-01'));
    const input = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(input).not.toBeNull();
    expect(input.value).toBe('2026-10-01');
  });

  it('pressing Escape in date edit mode reverts to display without saving', () => {
    defaultUsePlan({ plan: activePlan });
    const mockFetch = vi.fn();
    vi.stubGlobal('fetch', mockFetch);
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    fireEvent.click(screen.getByText('Target: 2026-10-01'));
    const input = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2027-01-01' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.getByText('Target: 2026-10-01')).toBeInTheDocument();
    expect(mockFetch).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('pressing Enter in date edit mode calls PATCH /api/plan with new targetDate', async () => {
    const refreshPlan = vi.fn().mockResolvedValue(undefined);
    defaultUsePlan({ plan: activePlan, refreshPlan });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);
    fireEvent.click(screen.getByText('Target: 2026-10-01'));
    const input = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '2027-03-15' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    await waitFor(() => {
      const patchCall = mockFetch.mock.calls.find((c: unknown[]) => c[0] === '/api/plan');
      expect(patchCall).toBeDefined();
      const body = JSON.parse((patchCall![1] as { body: string }).body);
      expect(body.targetDate).toBe('2027-03-15');
    });
    vi.unstubAllGlobals();
  });
});

describe('handleGetFeedback XML stripping', () => {
  const chatDefaults = {
    sendMessage: vi.fn().mockResolvedValue(''),
    messages: [],
    plan: null,
    isStreaming: false,
    isGeneratingPlan: false,
    isLoading: false,
    isBusy: false,
    error: null,
    startPlan: vi.fn(),
    startOver: vi.fn(),
    clearError: vi.fn(),
  };

  beforeEach(() => {
    vi.mocked(useChatContext).mockReturnValue({ ...chatDefaults });
    vi.unstubAllGlobals();
  });

  it('strips self-closing XML tags before saving progressFeedback', async () => {
    const rawResponse = 'Good progress! <plan:update week="1" day="A" guidelines="easy run"/> Keep it up!';
    const mockSendMessage = vi.fn().mockResolvedValue(rawResponse);
    vi.mocked(useChatContext).mockReturnValue({ ...chatDefaults, sendMessage: mockSendMessage });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    defaultUsePlan({ plan: activePlan, refreshPlan: vi.fn().mockResolvedValue(undefined) });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /get plan feedback/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      // Find the call to /api/plan (PATCH) specifically
      const patchCall = mockFetch.mock.calls.find((c: unknown[]) => c[0] === '/api/plan');
      expect(patchCall).toBeDefined();
      const body = JSON.parse((patchCall![1] as { body: string }).body);
      expect(body.progressFeedback).toBe('Good progress!  Keep it up!');
    });
  });

  it('does not call PATCH /api/plan when response is only XML tags', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue('<plan:update week="1" day="A" guidelines="x"/>');
    vi.mocked(useChatContext).mockReturnValue({ ...chatDefaults, sendMessage: mockSendMessage });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    defaultUsePlan({ plan: activePlan, refreshPlan: vi.fn().mockResolvedValue(undefined) });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /get plan feedback/i }));
    await waitFor(() => expect(mockSendMessage).toHaveBeenCalled());
    // Verify /api/plan (PATCH) was NOT called
    const planPatchCall = mockFetch.mock.calls.find((c: unknown[]) => c[0] === '/api/plan');
    expect(planPatchCall).toBeUndefined();
  });

  it('does not call PATCH /api/plan when response is empty string', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue('');
    vi.mocked(useChatContext).mockReturnValue({ ...chatDefaults, sendMessage: mockSendMessage });
    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    defaultUsePlan({ plan: activePlan, refreshPlan: vi.fn().mockResolvedValue(undefined) });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /get plan feedback/i }));
    await waitFor(() => expect(mockSendMessage).toHaveBeenCalled());
    // Verify /api/plan (PATCH) was NOT called
    const planPatchCall = mockFetch.mock.calls.find((c: unknown[]) => c[0] === '/api/plan');
    expect(planPatchCall).toBeUndefined();
  });

  it('passes plain text through unchanged', async () => {
    const plainText = 'You are making great progress!';
    const mockSendMessage = vi.fn().mockResolvedValue(plainText);
    vi.mocked(useChatContext).mockReturnValue({ ...chatDefaults, sendMessage: mockSendMessage });

    const mockFetch = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', mockFetch);

    defaultUsePlan({ plan: activePlan, refreshPlan: vi.fn().mockResolvedValue(undefined) });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: /get plan feedback/i }));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalled();
      // Find the call to /api/plan (PATCH) specifically
      const patchCall = mockFetch.mock.calls.find((c: unknown[]) => c[0] === '/api/plan');
      expect(patchCall).toBeDefined();
      const body = JSON.parse((patchCall![1] as { body: string }).body);
      expect(body.progressFeedback).toBe(plainText);
    });
  });
});
