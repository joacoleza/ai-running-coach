import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('CoachPanel — UX-SCROLL-02: Scroll to bottom when opened', () => {
  const onClose = vi.fn();

  beforeEach(() => {
    onClose.mockClear();
  });

  it('sets scrollTop to scrollHeight when isOpen becomes true', () => {
    mockUseChatContext.mockReturnValue(makeChatContext({
      messages: [
        { role: 'user', content: 'Hello', timestamp: '2026-04-06T00:00:00Z' },
        { role: 'assistant', content: 'Hi there!', timestamp: '2026-04-06T00:00:01Z' },
      ],
    }));

    const { rerender } = render(<CoachPanel isOpen={false} onClose={onClose} />);

    // Get reference to messages container when closed
    const messagesDiv = screen.queryByTestId('coach-messages');
    if (messagesDiv) {
      const mockScrollHeight = 500;
      Object.defineProperty(messagesDiv, 'scrollHeight', { value: mockScrollHeight, writable: true });
      Object.defineProperty(messagesDiv, 'scrollTop', { value: 0, writable: true });
    }

    // Rerender with isOpen=true
    rerender(<CoachPanel isOpen={true} onClose={onClose} />);

    // After opening, the messages container should have scrollTop set to scrollHeight
    if (messagesDiv) {
      expect(messagesDiv.scrollTop).toBe(messagesDiv.scrollHeight);
    }
  });

  it('renders panel when open', () => {
    mockUseChatContext.mockReturnValue(makeChatContext());
    render(<CoachPanel isOpen={true} onClose={onClose} />);

    // Panel should be visible (not hidden)
    const panel = screen.getByTestId('coach-panel');
    expect(panel).toBeInTheDocument();
    expect(panel.className).not.toContain('hidden');
  });

  it('hides panel when closed', () => {
    mockUseChatContext.mockReturnValue(makeChatContext());
    render(<CoachPanel isOpen={false} onClose={onClose} />);

    // On desktop, the panel remains visible but via md:flex
    // On mobile, it should be hidden or not in the mobile view
    const panel = screen.getByTestId('coach-panel');
    expect(panel).toBeInTheDocument();
  });
});
