import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { TrainingPlan } from '../pages/TrainingPlan';
import type { PlanData } from '../hooks/usePlan';

vi.mock('../hooks/usePlan', () => ({
  usePlan: vi.fn(),
}));

vi.mock('../contexts/ChatContext', () => ({
  useChatContext: vi.fn(),
}));

import { usePlan } from '../hooks/usePlan';
import { useChatContext } from '../contexts/ChatContext';

const mockUsePlan = vi.mocked(usePlan);
const mockUseChatContext = vi.mocked(useChatContext);

function defaultUsePlan(overrides: Partial<ReturnType<typeof usePlan>> = {}) {
  mockUsePlan.mockReturnValue({
    plan: null,
    linkedRuns: new Map(),
    isLoading: false,
    error: null,
    refreshPlan: vi.fn().mockResolvedValue(undefined),
    updateDay: vi.fn().mockResolvedValue(undefined),
    deleteDay: vi.fn(),
    addDay: vi.fn(),
    archivePlan: vi.fn(),
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

const activePlanWithFeedback: PlanData = {
  ...activePlan,
  progressFeedback: 'Good progress this week!\n\nKeep up the steady pace.',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('TrainingPlan — UX-COACHING-01: "Get plan feedback" button in Coach Feedback panel header', () => {
  it('renders "Get plan feedback" button when no feedback exists', () => {
    const mockSendMessage = vi.fn().mockResolvedValue('Great work!');
    mockUseChatContext.mockReturnValue({
      sendMessage: mockSendMessage,
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
    });

    defaultUsePlan({ plan: activePlan, refreshPlan: vi.fn().mockResolvedValue(undefined) });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    const feedbackBtn = screen.getByRole('button', { name: /get plan feedback/i });
    expect(feedbackBtn).toBeInTheDocument();
  });

  it('renders "Refresh feedback" button when feedback already exists', () => {
    const mockSendMessage = vi.fn().mockResolvedValue('');
    mockUseChatContext.mockReturnValue({
      sendMessage: mockSendMessage,
      messages: [],
      plan: activePlanWithFeedback,
      isStreaming: false,
      isGeneratingPlan: false,
      isLoading: false,
      isBusy: false,
      error: null,
      startPlan: vi.fn(),
      startOver: vi.fn(),
      clearError: vi.fn(),
    });

    defaultUsePlan({ plan: activePlanWithFeedback, refreshPlan: vi.fn().mockResolvedValue(undefined) });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    const feedbackBtn = screen.getByRole('button', { name: /refresh feedback/i });
    expect(feedbackBtn).toBeInTheDocument();
  });

  it('button is in the Coach Feedback panel header, not in objective box', () => {
    const mockSendMessage = vi.fn().mockResolvedValue('');
    mockUseChatContext.mockReturnValue({
      sendMessage: mockSendMessage,
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
    });

    defaultUsePlan({ plan: activePlan, refreshPlan: vi.fn().mockResolvedValue(undefined) });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    // Objective box should contain "marathon" but NOT the feedback button
    const objectiveEl = screen.getByText('marathon');
    const objectiveBox = objectiveEl.closest('.bg-blue-50');
    expect(objectiveBox).toBeInTheDocument();
    expect(objectiveBox?.textContent).not.toContain('Get plan feedback');
    expect(objectiveBox?.textContent).not.toContain('Refresh feedback');
  });
});

describe('TrainingPlan — UX-COACHING-02: Coach Feedback panel non-expandable when no feedback', () => {
  it('panel shows only header when no feedback exists (no collapse toggle)', () => {
    const mockSendMessage = vi.fn().mockResolvedValue('');
    mockUseChatContext.mockReturnValue({
      sendMessage: mockSendMessage,
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
    });

    defaultUsePlan({ plan: activePlan, refreshPlan: vi.fn().mockResolvedValue(undefined) });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    // Should see the header with button
    expect(screen.getByText('Coach Feedback')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /get plan feedback/i })).toBeInTheDocument();

    // Should NOT see Show/Hide toggle buttons
    expect(screen.queryByText(/Show/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Hide/i)).not.toBeInTheDocument();
  });

  it('panel shows expand toggle when feedback exists', () => {
    const mockSendMessage = vi.fn().mockResolvedValue('');
    mockUseChatContext.mockReturnValue({
      sendMessage: mockSendMessage,
      messages: [],
      plan: activePlanWithFeedback,
      isStreaming: false,
      isGeneratingPlan: false,
      isLoading: false,
      isBusy: false,
      error: null,
      startPlan: vi.fn(),
      startOver: vi.fn(),
      clearError: vi.fn(),
    });

    defaultUsePlan({ plan: activePlanWithFeedback, refreshPlan: vi.fn().mockResolvedValue(undefined) });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    // Should see both header and toggle button (Show when collapsed)
    expect(screen.getByText('Coach Feedback')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /refresh feedback/i })).toBeInTheDocument();
    expect(screen.getByText(/Show/i)).toBeInTheDocument();
  });

  it('feedback content shows paragraph spacing', () => {
    const mockSendMessage = vi.fn().mockResolvedValue('');
    mockUseChatContext.mockReturnValue({
      sendMessage: mockSendMessage,
      messages: [],
      plan: activePlanWithFeedback,
      isStreaming: false,
      isGeneratingPlan: false,
      isLoading: false,
      isBusy: false,
      error: null,
      startPlan: vi.fn(),
      startOver: vi.fn(),
      clearError: vi.fn(),
    });

    defaultUsePlan({ plan: activePlanWithFeedback, refreshPlan: vi.fn().mockResolvedValue(undefined) });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    // Click Show to expand
    const showBtn = screen.getByText(/Show/i);
    fireEvent.click(showBtn);

    // Should see both paragraphs of feedback
    expect(screen.getByText('Good progress this week!')).toBeInTheDocument();
    expect(screen.getByText('Keep up the steady pace.')).toBeInTheDocument();
  });

  it('toggle button changes between Show and Hide on click', () => {
    const mockSendMessage = vi.fn().mockResolvedValue('');
    mockUseChatContext.mockReturnValue({
      sendMessage: mockSendMessage,
      messages: [],
      plan: activePlanWithFeedback,
      isStreaming: false,
      isGeneratingPlan: false,
      isLoading: false,
      isBusy: false,
      error: null,
      startPlan: vi.fn(),
      startOver: vi.fn(),
      clearError: vi.fn(),
    });

    defaultUsePlan({ plan: activePlanWithFeedback, refreshPlan: vi.fn().mockResolvedValue(undefined) });
    render(<MemoryRouter><TrainingPlan /></MemoryRouter>);

    let toggleBtn = screen.getByText(/Show/i);
    expect(toggleBtn).toBeInTheDocument();

    fireEvent.click(toggleBtn);

    // Now should say Hide
    toggleBtn = screen.getByText(/Hide/i);
    expect(toggleBtn).toBeInTheDocument();

    // Click again to hide
    fireEvent.click(toggleBtn);

    // Back to Show
    toggleBtn = screen.getByText(/Show/i);
    expect(toggleBtn).toBeInTheDocument();
  });
});
