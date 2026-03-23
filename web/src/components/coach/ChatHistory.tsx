import { ChatMessage } from './ChatMessage';
import type { Message } from '../../hooks/useChat';

interface ChatHistoryProps {
  messages: Message[];
  onBack: () => void;
}

export function ChatHistory({ messages, onBack }: ChatHistoryProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center px-4 py-2 border-b border-gray-200">
        <button onClick={onBack} className="text-sm text-blue-600 hover:text-blue-800">
          &larr; Back to Chat
        </button>
        <span className="ml-2 text-sm font-medium text-gray-700">Message History</span>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="text-center text-gray-400 text-sm mt-8">No messages yet</p>
        ) : (
          messages.map((msg, i) => (
            <ChatMessage key={i} role={msg.role} content={msg.content} />
          ))
        )}
      </div>
    </div>
  );
}
