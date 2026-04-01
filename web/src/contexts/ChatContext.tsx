import { createContext, useContext } from 'react';
import { useChat } from '../hooks/useChat';
import type { Message } from '../hooks/useChat';

interface ChatContextValue {
  messages: Message[];
  plan: ReturnType<typeof useChat>['plan'];
  isStreaming: boolean;
  isGeneratingPlan: boolean;
  isLoading: boolean;
  isBusy: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<string>;
  startPlan: (mode: 'conversational' | 'paste') => Promise<void>;
  startOver: () => void;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const chat = useChat();
  return <ChatContext.Provider value={chat}>{children}</ChatContext.Provider>;
}

export function useChatContext(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}
