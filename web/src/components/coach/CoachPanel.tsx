import { useState, useRef, useEffect } from 'react';
import { useChat } from '../../hooks/useChat';
import { ChatMessage } from './ChatMessage';
import { ChatHistory } from './ChatHistory';

export function CoachPanel() {
  const { messages, plan, isStreaming, isLoading, error, sendMessage, startPlan, startOver, clearError } =
    useChat();
  const [input, setInput] = useState('');
  const [showHistory, setShowHistory] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isStreaming) return;
    const text = input;
    setInput('');
    await sendMessage(text);
  };

  const handlePasteSend = async () => {
    if (!pasteText.trim() || isStreaming) return;
    const text = `Here is my existing training plan from another conversation:\n\n${pasteText}`;
    setPasteText('');
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  if (showHistory) {
    return (
      <aside className="flex flex-col w-80 lg:w-96 border-l border-gray-200 bg-white min-h-screen">
        <ChatHistory messages={messages} onBack={() => setShowHistory(false)} />
      </aside>
    );
  }

  // Determine header title
  const headerTitle = !plan ? 'AI Coach' : plan.status === 'onboarding' ? 'Onboarding' : 'Coach Chat';

  return (
    <aside className="flex flex-col w-80 lg:w-96 border-l border-gray-200 bg-white min-h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900">{headerTitle}</h2>
        <div className="flex items-center gap-2">
          {plan?.status === 'onboarding' && (
            <button
              onClick={() => void startOver()}
              className="text-xs text-red-500 hover:text-red-700"
              title="Start over"
            >
              Start Over
            </button>
          )}
          <button
            onClick={() => setShowHistory(true)}
            className="text-gray-400 hover:text-gray-600"
            title="Message history"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-50 border-b border-red-200 text-sm text-red-700 flex justify-between items-center">
          <span>{error}</span>
          <button onClick={clearError} className="text-red-500 hover:text-red-700 text-xs ml-2">
            Dismiss
          </button>
        </div>
      )}

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto p-4">
        {isLoading ? (
          <p className="text-center text-gray-400 text-sm mt-8">Loading...</p>
        ) : !plan ? (
          /* No plan -- show start options (D-01) */
          <div className="flex flex-col items-center justify-center h-full gap-4 px-4">
            <p className="text-gray-600 text-sm text-center">
              Welcome! Let&apos;s create your training plan.
            </p>
            <button
              onClick={() => void startPlan('conversational')}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
            >
              Start New Plan
            </button>
            <button
              onClick={() => void startPlan('paste')}
              className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200"
            >
              Import from Existing Plan
            </button>
          </div>
        ) : (
          <>
            {/* Paste textarea for paste mode before first message */}
            {plan.status === 'onboarding' &&
              plan.onboardingMode === 'paste' &&
              messages.length === 0 && (
                <div className="mb-4">
                  <p className="text-sm text-gray-600 mb-2">
                    Paste your training plan conversation below:
                  </p>
                  <textarea
                    value={pasteText}
                    onChange={(e) => setPasteText(e.target.value)}
                    className="w-full h-40 p-3 border border-gray-300 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Paste your LLM conversation here..."
                  />
                  <button
                    onClick={() => void handlePasteSend()}
                    disabled={!pasteText.trim() || isStreaming}
                    className="mt-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Send to Coach
                  </button>
                </div>
              )}
            {messages.map((msg, i) => (
              <ChatMessage key={i} role={msg.role} content={msg.content} />
            ))}
            {isStreaming &&
              messages.length > 0 &&
              messages[messages.length - 1].content === '' && (
                <div className="text-gray-400 text-sm animate-pulse">Coach is typing...</div>
              )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area -- only show when plan exists */}
      {plan && (
        <div className="border-t border-gray-200 p-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={isStreaming}
              placeholder={isStreaming ? 'Coach is responding...' : 'Type a message...'}
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
            />
            <button
              onClick={() => void handleSend()}
              disabled={!input.trim() || isStreaming}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
