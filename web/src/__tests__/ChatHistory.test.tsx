import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatHistory } from '../components/coach/ChatHistory';
import type { Message } from '../hooks/useChat';

describe('ChatHistory', () => {
  const onBack = vi.fn();

  it('renders back button and heading', () => {
    render(<ChatHistory messages={[]} onBack={onBack} />);
    expect(screen.getByRole('button', { name: /back to chat/i })).toBeInTheDocument();
    expect(screen.getByText('Message History')).toBeInTheDocument();
  });

  it('shows empty state when no messages', () => {
    render(<ChatHistory messages={[]} onBack={onBack} />);
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it('renders each message using ChatMessage', () => {
    const messages: Message[] = [
      { role: 'user', content: 'Hello coach' },
      { role: 'assistant', content: 'Hi there!' },
    ];
    render(<ChatHistory messages={messages} onBack={onBack} />);
    expect(screen.getByText('Hello coach')).toBeInTheDocument();
    expect(screen.getByText('Hi there!')).toBeInTheDocument();
  });

  it('calls onBack when back button is clicked', () => {
    render(<ChatHistory messages={[]} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: /back to chat/i }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
