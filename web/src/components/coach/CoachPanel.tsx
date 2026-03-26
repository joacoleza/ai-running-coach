import { useState, useRef, useEffect } from 'react';
import { useChatContext } from '../../contexts/ChatContext';
import { ChatMessage } from './ChatMessage';

interface CoachPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CoachPanel({ isOpen, onClose }: CoachPanelProps) {
  const { messages, plan, isStreaming, isGeneratingPlan, isLoading, isBusy, error, sendMessage, startPlan, startOver, clearError } =
    useChatContext();
  const [input, setInput] = useState('');
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll chat container to bottom on new messages — avoids scrolling the whole page
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  // Focus input when open-coach event fires (e.g. "Update Plan" button on desktop)
  useEffect(() => {
    const handler = () => {
      setTimeout(() => inputRef.current?.focus(), 50);
    };
    window.addEventListener('open-coach', handler);
    return () => window.removeEventListener('open-coach', handler);
  }, []);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const isActive = isStreaming || isGeneratingPlan || isBusy;

  // Mobile: bottom sheet overlay (partial height) so the app is visible behind it.
  // Desktop (md+): always visible as fixed-width right panel.
  const asideClass = isOpen
    ? 'flex fixed inset-x-0 bottom-0 h-[85vh] z-50 flex-col bg-white rounded-t-2xl shadow-xl md:relative md:inset-auto md:h-auto md:rounded-none md:shadow-none md:z-auto md:w-80 lg:w-96 md:border-l md:border-gray-200 md:h-screen md:sticky md:top-0'
    : 'hidden md:flex md:flex-col md:w-80 lg:w-96 md:border-l md:border-gray-200 md:bg-white md:h-screen md:sticky md:top-0';

  // Determine header title
  const headerTitle = !plan ? 'AI Coach' : plan.status === 'onboarding' ? 'Onboarding' : 'Coach Chat';

  return (
    <>
    {/* Mobile backdrop — dims app content behind the bottom sheet */}
    {isOpen && (
      <div
        className="fixed inset-0 bg-black/40 z-40 md:hidden"
        aria-hidden="true"
        onClick={onClose}
      />
    )}
    <aside className={asideClass} data-testid="coach-panel">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{headerTitle}</h2>
        <div className="flex items-center gap-2">
          {plan?.status === 'onboarding' && (
            <button
              onClick={startOver}
              disabled={isActive}
              className="cursor-pointer text-xs text-red-500 hover:text-red-700 disabled:opacity-40 disabled:cursor-not-allowed"
              title="Start over"
            >
              Start Over
            </button>
          )}
          {/* Close button — mobile only */}
          <button
            onClick={onClose}
            className="cursor-pointer md:hidden text-gray-400 hover:text-gray-600"
            aria-label="Close coach"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={clearError} className="cursor-pointer text-red-500 hover:text-red-700 text-xs ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Messages area */}
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto overscroll-contain p-4">
        {isLoading ? (
          <p className="text-center text-gray-400 text-sm mt-8">Loading...</p>
        ) : !plan ? (
          /* No plan -- show start options */
          <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
            <p className="text-gray-600 text-sm text-center">
              Welcome! Let&apos;s create your training plan.
            </p>
            <button
              onClick={() => void startPlan('conversational')}
              disabled={isActive}
              className="cursor-pointer w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isBusy ? (
                <>
                  <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                  </svg>
                  Starting...
                </>
              ) : 'Start New Plan'}
            </button>
          </div>
        ) : (
          <>
            {messages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))}
            {isGeneratingPlan && (
              <div className="flex items-center gap-2 text-sm text-blue-600 animate-pulse mt-2">
                <svg className="h-4 w-4 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                </svg>
                Building your training plan...
              </div>
            )}
            {isStreaming && !isGeneratingPlan && (
              <div className="flex items-center gap-1.5 text-gray-400 text-sm mt-1">
                <span className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="inline-block w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            )}
            <div />
          </>
        )}
      </div>

      {/* Input area -- only show when plan exists */}
      {plan && (
        <div className="border-t border-gray-200 p-3">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isActive}
              placeholder={isStreaming ? 'Coach is responding...' : isGeneratingPlan ? 'Building your plan...' : 'Type a message...'}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isActive}
              className="cursor-pointer px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </aside>
    </>
  );
}
