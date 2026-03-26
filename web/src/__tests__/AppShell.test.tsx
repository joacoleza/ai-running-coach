import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import type { PlanData } from '../hooks/useChat';

vi.mock('../contexts/ChatContext', () => ({
  useChatContext: vi.fn(),
}));

vi.mock('../components/coach/CoachPanel', () => ({
  CoachPanel: ({ isOpen }: { isOpen: boolean }) => (
    <div data-testid="coach-panel" data-open={String(isOpen)} />
  ),
}));

import { useChatContext } from '../contexts/ChatContext';
const mockUseChatContext = vi.mocked(useChatContext);

function makeContext(plan: PlanData | null) {
  return {
    plan,
    messages: [],
    isStreaming: false,
    isGeneratingPlan: false,
    isLoading: false,
    isBusy: false,
    error: null,
    sendMessage: vi.fn(),
    startPlan: vi.fn(),
    startOver: vi.fn(),
    clearError: vi.fn(),
  };
}

const noPlan = null;
const onboardingPlan: PlanData = {
  _id: 'p1',
  status: 'onboarding',
  onboardingMode: 'conversational',
  onboardingStep: 2,
  goal: { eventType: '10K', targetDate: '2026-06-01', weeklyMileage: 20, availableDays: 3, units: 'km' },
  phases: [],
};
const activePlan: PlanData = {
  _id: 'p2',
  status: 'active',
  onboardingMode: 'conversational',
  onboardingStep: 6,
  goal: { eventType: '10K', targetDate: '2026-06-01', weeklyMileage: 20, availableDays: 3, units: 'km' },
  phases: [],
};

function renderShell(plan: PlanData | null) {
  mockUseChatContext.mockReturnValue(makeContext(plan));
  return render(
    <MemoryRouter>
      <AppShell><div>content</div></AppShell>
    </MemoryRouter>
  );
}

describe('AppShell FAB — no plan', () => {
  it('shows "Start New Plan" button with text when there is no plan', () => {
    renderShell(noPlan);
    expect(screen.getByRole('button', { name: /start new plan/i })).toBeInTheDocument();
  });

  it('does not show "Continue Planning" button when there is no plan', () => {
    renderShell(noPlan);
    expect(screen.queryByRole('button', { name: /continue planning/i })).not.toBeInTheDocument();
  });
});

describe('AppShell FAB — onboarding plan', () => {
  it('shows "Continue Planning" button when plan is onboarding', () => {
    renderShell(onboardingPlan);
    expect(screen.getByRole('button', { name: /continue planning/i })).toBeInTheDocument();
  });

  it('does not show "Start New Plan" when plan is onboarding', () => {
    renderShell(onboardingPlan);
    expect(screen.queryByRole('button', { name: /start new plan/i })).not.toBeInTheDocument();
  });
});

describe('AppShell FAB — active plan (icon only)', () => {
  it('shows an icon-only FAB (aria-label="Open coach") when plan is active', () => {
    renderShell(activePlan);
    expect(screen.getByRole('button', { name: /open coach/i })).toBeInTheDocument();
  });

  it('icon-only FAB has no visible text label', () => {
    renderShell(activePlan);
    const fab = screen.getByRole('button', { name: /open coach/i });
    // Text content should be empty (only SVG icon inside)
    expect(fab.textContent?.trim()).toBe('');
  });

  it('does not show Start New Plan or Continue Planning text for active plan', () => {
    renderShell(activePlan);
    expect(screen.queryByRole('button', { name: /start new plan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue planning/i })).not.toBeInTheDocument();
  });
});

describe('AppShell FAB — interaction', () => {
  beforeEach(() => {
    mockUseChatContext.mockReturnValue(makeContext(noPlan));
  });

  it('hides FAB when coach panel is opened', () => {
    renderShell(noPlan);
    const fab = screen.getByRole('button', { name: /start new plan/i });
    fireEvent.click(fab);
    expect(screen.queryByRole('button', { name: /start new plan/i })).not.toBeInTheDocument();
  });
});

describe('AppShell — auto-close coach panel when plan becomes active', () => {
  it('closes the coach panel when plan transitions from onboarding to active', async () => {
    mockUseChatContext.mockReturnValue(makeContext(onboardingPlan));
    const { rerender } = render(
      <MemoryRouter>
        <AppShell><div>content</div></AppShell>
      </MemoryRouter>
    );

    // Open the coach panel
    fireEvent.click(screen.getByRole('button', { name: /continue planning/i }));
    expect(screen.getByTestId('coach-panel').dataset.open).toBe('true');

    // Transition plan to active
    await act(async () => {
      mockUseChatContext.mockReturnValue(makeContext(activePlan));
      rerender(
        <MemoryRouter>
          <AppShell><div>content</div></AppShell>
        </MemoryRouter>
      );
    });

    expect(screen.getByTestId('coach-panel').dataset.open).toBe('false');
  });

  it('does NOT auto-close if plan was already active on mount', () => {
    mockUseChatContext.mockReturnValue(makeContext(activePlan));
    render(
      <MemoryRouter>
        <AppShell><div>content</div></AppShell>
      </MemoryRouter>
    );
    // Panel starts closed, not affected by the existing active status
    expect(screen.getByTestId('coach-panel').dataset.open).toBe('false');
    // Icon-only FAB still shows
    expect(screen.getByRole('button', { name: /open coach/i })).toBeInTheDocument();
  });
});
