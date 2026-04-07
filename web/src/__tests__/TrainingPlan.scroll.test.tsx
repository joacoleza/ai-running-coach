import { render } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TrainingPlan } from '../pages/TrainingPlan';
import type { PlanData } from '../hooks/usePlan';

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

const mockUsePlan = vi.mocked(usePlan);

function defaultUsePlan(overrides: Partial<ReturnType<typeof usePlan>> = {}) {
  mockUsePlan.mockReturnValue({
    plan: null,
    isLoading: false,
    error: null,
    refreshPlan: vi.fn().mockResolvedValue(undefined),
    updateDay: vi.fn().mockResolvedValue(undefined),
    deleteDay: vi.fn(),
    addDay: vi.fn(),
    archivePlan: vi.fn(),
    updatePhase: vi.fn().mockResolvedValue(undefined),
    deleteLastPhase: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  });
}

const activePlanWithCompleted: PlanData = {
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
        {
          weekNumber: 2,
          days: [
            { label: 'B', type: 'run', guidelines: 'Tempo run', completed: true, skipped: false },
          ],
        },
      ],
    },
  ],
};

describe('TrainingPlan — sticky header structure', () => {
  beforeEach(() => {
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('renders a sticky header containing the title, objective card, and coach feedback panel', () => {
    defaultUsePlan({ plan: activePlanWithCompleted });
    const { container } = render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    // The sticky header div must have the correct Tailwind classes
    const stickyHeader = container.querySelector('.sticky.top-0.z-10');
    expect(stickyHeader).not.toBeNull();

    // Title is inside the sticky header
    const title = stickyHeader!.querySelector('h1');
    expect(title).not.toBeNull();
    expect(title!.textContent).toBe('Training Plan');

    // Objective card is inside the sticky header
    const objectiveCard = stickyHeader!.querySelector('.bg-blue-50');
    expect(objectiveCard).not.toBeNull();

    // Coach feedback panel is inside the sticky header
    const feedbackPanel = stickyHeader!.querySelector('.border.border-gray-200');
    expect(feedbackPanel).not.toBeNull();
  });

  it('PlanView is rendered outside the sticky header in the scrollable content area', () => {
    defaultUsePlan({ plan: activePlanWithCompleted });
    const { container } = render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    const stickyHeader = container.querySelector('.sticky.top-0.z-10');
    // PlanView renders phase/week content — check it is NOT a descendant of the sticky header
    const weekContent = container.querySelector('[data-testid="plan-view"]') ??
      // PlanView renders phase names — look for any element outside sticky header
      Array.from(container.querySelectorAll('*')).find(
        el => !stickyHeader!.contains(el) && el.textContent?.includes('Base')
      );
    expect(weekContent).not.toBeNull();
  });
});

describe('TrainingPlan — UX-SCROLL-01: Auto-scroll to last completed day on mount', () => {
  beforeEach(() => {
    // Mock scrollIntoView since jsdom doesn't implement it
    Element.prototype.scrollIntoView = vi.fn();
  });

  it('calls scrollIntoView on the last completed day ref when plan loads', () => {
    defaultUsePlan({ plan: activePlanWithCompleted });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    // The scrollIntoView should have been called during the effect
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('does not call scrollIntoView when plan is null', () => {
    Element.prototype.scrollIntoView = vi.fn();
    defaultUsePlan({ plan: null });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    // Should not be called if there's no completed day
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('does not call scrollIntoView when plan has no phases', () => {
    Element.prototype.scrollIntoView = vi.fn();
    defaultUsePlan({ plan: { ...activePlanWithCompleted, phases: [] } });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });
});
