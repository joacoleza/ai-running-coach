import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CoachPanel } from '../components/coach/CoachPanel';
import type { PlanData } from '../hooks/useChat';

const mockSendMessage = vi.fn();
const mockStartPlan = vi.fn();
const mockStartOver = vi.fn();
const mockClearError = vi.fn();

function makeChatContext(overrides: Partial<{
  plan: PlanData | null;
  messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }>;
  isStreaming: boolean;
  isGeneratingPlan: boolean;
  isLoading: boolean;
  isBusy: boolean;
  error: string | null;
  startPlan: (mode: 'conversational' | 'paste') => Promise<void>;
}> = {}) {
  return {
    messages: [],
    plan: null,
    isStreaming: false,
    isGeneratingPlan: false,
    isLoading: false,
    isBusy: false,
    error: null,
    sendMessage: mockSendMessage,
    startPlan: mockStartPlan,
    startOver: mockStartOver,
    clearError: mockClearError,
    ...overrides,
  };
}

vi.mock('../contexts/ChatContext', () => ({
  useChatContext: vi.fn(),
}));

import { useChatContext } from '../contexts/ChatContext';
const mockUseChatContext = vi.mocked(useChatContext);

const onClose = vi.fn();

describe('CoachPanel — mobile overlay (bottom sheet)', () => {
  it('uses bottom-sheet classes instead of full-screen inset-0 when open', () => {
    mockUseChatContext.mockReturnValue(makeChatContext());
    render(<CoachPanel isOpen={true} onClose={onClose} />);
    const panel = screen.getByTestId('coach-panel');
    expect(panel.className).toContain('rounded-t-2xl');
    expect(panel.className).toContain('bottom-0');
    expect(panel.className).not.toMatch(/\binset-0\b/);
  });

  it('renders a backdrop overlay when open on mobile', () => {
    mockUseChatContext.mockReturnValue(makeChatContext());
    render(<CoachPanel isOpen={true} onClose={onClose} />);
    // backdrop has aria-hidden and bg-black/40
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).not.toBeNull();
    expect(backdrop!.className).toContain('bg-black/40');
  });

  it('does not render backdrop when closed', () => {
    mockUseChatContext.mockReturnValue(makeChatContext());
    render(<CoachPanel isOpen={false} onClose={onClose} />);
    const backdrop = document.querySelector('[aria-hidden="true"]');
    expect(backdrop).toBeNull();
  });

  it('calls onClose when backdrop is clicked', () => {
    const handleClose = vi.fn();
    mockUseChatContext.mockReturnValue(makeChatContext());
    render(<CoachPanel isOpen={true} onClose={handleClose} />);
    const backdrop = document.querySelector('[aria-hidden="true"]') as HTMLElement;
    fireEvent.click(backdrop);
    expect(handleClose).toHaveBeenCalled();
  });
});

describe('CoachPanel — no plan state (start button)', () => {
  it('shows Start New Plan button when plan is null', () => {
    mockUseChatContext.mockReturnValue(makeChatContext({ plan: null }));
    render(<CoachPanel isOpen={true} onClose={onClose} />);
    expect(screen.getByRole('button', { name: /start new plan/i })).toBeInTheDocument();
  });

  it('calls startPlan when Start New Plan is clicked', () => {
    const startPlan = vi.fn().mockResolvedValue(undefined);
    mockUseChatContext.mockReturnValue(makeChatContext({ plan: null, startPlan }));
    render(<CoachPanel isOpen={true} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: /start new plan/i }));
    expect(startPlan).toHaveBeenCalledWith('conversational');
  });
});

describe('CoachPanel — cursor-pointer on interactive elements', () => {
  const activePlan: PlanData = {
    _id: 'p1',
    status: 'active',
    onboardingMode: 'conversational',
    onboardingStep: 6,
    goal: { eventType: '10K', targetDate: '2026-06-01', weeklyMileage: 30, availableDays: 4, units: 'km' },
    phases: [],
  };

  it('Start New Plan button has cursor-pointer', () => {
    mockUseChatContext.mockReturnValue(makeChatContext({ plan: null }));
    render(<CoachPanel isOpen={true} onClose={onClose} />);
    expect(screen.getByRole('button', { name: /start new plan/i }).className).toContain('cursor-pointer');
  });

  it('Send button has cursor-pointer', () => {
    mockUseChatContext.mockReturnValue(makeChatContext({ plan: activePlan }));
    render(<CoachPanel isOpen={true} onClose={onClose} />);
    expect(screen.getByRole('button', { name: /^send$/i }).className).toContain('cursor-pointer');
  });

  it('Start Over button has cursor-pointer when in onboarding', () => {
    const onboardingPlan = { ...activePlan, status: 'onboarding' as const };
    mockUseChatContext.mockReturnValue(makeChatContext({ plan: onboardingPlan }));
    render(<CoachPanel isOpen={true} onClose={onClose} />);
    expect(screen.getByText('Start Over').className).toContain('cursor-pointer');
  });

  it('Dismiss error button has cursor-pointer', () => {
    mockUseChatContext.mockReturnValue(makeChatContext({ plan: activePlan, error: 'Something went wrong' }));
    render(<CoachPanel isOpen={true} onClose={onClose} />);
    expect(screen.getByText('Dismiss').className).toContain('cursor-pointer');
  });
});

describe('CoachPanel — active plan (no start button)', () => {
  beforeEach(() => { mockSendMessage.mockClear(); });

  const activePlan: PlanData = {
    _id: 'p1',
    status: 'active',
    onboardingMode: 'conversational',
    onboardingStep: 6,
    goal: { eventType: '10K', targetDate: '2026-06-01', weeklyMileage: 30, availableDays: 4, units: 'km' },
    phases: [],
  };

  it('does not show Start New Plan button when plan is active', () => {
    mockUseChatContext.mockReturnValue(makeChatContext({ plan: activePlan }));
    render(<CoachPanel isOpen={true} onClose={onClose} />);
    expect(screen.queryByRole('button', { name: /start new plan/i })).not.toBeInTheDocument();
  });

  it('shows chat input when plan is active', () => {
    mockUseChatContext.mockReturnValue(makeChatContext({ plan: activePlan }));
    render(<CoachPanel isOpen={true} onClose={onClose} />);
    expect(screen.getByPlaceholderText(/type a message/i)).toBeInTheDocument();
  });

  it('input is a textarea (supports multiline)', () => {
    mockUseChatContext.mockReturnValue(makeChatContext({ plan: activePlan }));
    render(<CoachPanel isOpen={true} onClose={onClose} />);
    const input = screen.getByPlaceholderText(/type a message/i);
    expect(input.tagName).toBe('TEXTAREA');
  });

  it('Enter sends the message', () => {
    mockUseChatContext.mockReturnValue(makeChatContext({ plan: activePlan }));
    render(<CoachPanel isOpen={true} onClose={onClose} />);
    const textarea = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: false });
    expect(mockSendMessage).toHaveBeenCalledWith('hello');
  });

  it('Shift+Enter does not send the message', () => {
    mockUseChatContext.mockReturnValue(makeChatContext({ plan: activePlan }));
    render(<CoachPanel isOpen={true} onClose={onClose} />);
    const textarea = screen.getByPlaceholderText(/type a message/i);
    fireEvent.change(textarea, { target: { value: 'hello' } });
    fireEvent.keyDown(textarea, { key: 'Enter', shiftKey: true });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });
});
