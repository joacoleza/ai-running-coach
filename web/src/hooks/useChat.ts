import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlanPhase, PlanGoal } from './usePlan';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface PlanData {
  _id: string;
  status: 'onboarding' | 'active' | 'archived';
  onboardingMode: 'conversational' | 'paste';
  onboardingStep: number;
  goal: PlanGoal;
  objective?: 'marathon' | 'half-marathon' | '15km' | '10km' | '5km';
  targetDate?: string;
  phases: PlanPhase[];
}

interface UseChatReturn {
  messages: Message[];
  plan: PlanData | null;
  isStreaming: boolean;
  isLoading: boolean;
  error: string | null;
  sendMessage: (text: string) => Promise<void>;
  startPlan: (mode: 'conversational' | 'paste') => Promise<void>;
  startOver: () => void;
  clearError: () => void;
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-app-password': localStorage.getItem('app_password') ?? '',
  };
}

function extractGoalFromText(text: string): Record<string, unknown> {
  // The system prompt instructs Claude to include goal info in the response.
  // Try to find a <goal> block or extract from the conversation.
  const goalMatch = text.match(/<goal>([\s\S]*?)<\/goal>/);
  if (goalMatch) {
    try {
      return JSON.parse(goalMatch[1]);
    } catch {
      // fall through
    }
  }
  // Fallback: return a minimal goal -- the backend generatePlan will use what's provided
  return {
    eventType: 'marathon',
    targetDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    weeklyMileage: 0,
    availableDays: 4,
    units: 'km',
  };
}

export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchPlan = useCallback(async (): Promise<PlanData | null> => {
    try {
      const response = await fetch('/api/plan', {
        headers: authHeaders(),
      });
      if (response.ok) {
        const data = await response.json() as { plan: PlanData | null };
        return data.plan;
      }
    } catch {
      // Network errors are non-fatal here
    }
    return null;
  }, []);

  // On mount: fetch existing plan
  useEffect(() => {
    let cancelled = false;

    async function init() {
      setIsLoading(true);
      const existingPlan = await fetchPlan();
      if (!cancelled) {
        if (existingPlan && (existingPlan.status === 'onboarding' || existingPlan.status === 'active')) {
          setPlan(existingPlan);

          // Fetch past messages from MongoDB
          try {
            const msgResponse = await fetch(`/api/messages?planId=${existingPlan._id}`, {
              headers: authHeaders(),
            });
            if (msgResponse.ok) {
              const data = await msgResponse.json() as { messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }> };
              if (!cancelled && data.messages.length > 0) {
                setMessages(data.messages.map((m) => ({
                  role: m.role,
                  content: m.content,
                  timestamp: typeof m.timestamp === 'string' ? m.timestamp : new Date(m.timestamp).toISOString(),
                })));
              }
            }
          } catch {
            // Non-fatal: messages just won't be restored from history
          }
        }
        setIsLoading(false);
      }
    }

    void init();
    return () => {
      cancelled = true;
    };
  }, [fetchPlan]);

  const sendMessage = useCallback(async (text: string): Promise<void> => {
    if (!plan) return;

    // Optimistic: add user message immediately
    const userMessage: Message = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMessage]);

    // Add placeholder assistant message for streaming
    const assistantPlaceholder: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, assistantPlaceholder]);

    setIsStreaming(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ planId: plan._id, message: text }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Request failed' })) as { error?: string };
        setError(errData.error ?? 'Failed to send message');
        setIsStreaming(false);
        // Remove placeholder
        setMessages((prev) => prev.slice(0, -1));
        return;
      }

      const reader = response.body!.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedText = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from the buffer
        const lines = buffer.split('\n');
        // Keep the last (potentially incomplete) line in the buffer
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6).trim();
          if (!jsonStr) continue;

          let payload: { text?: string; done?: boolean; error?: string };
          try {
            payload = JSON.parse(jsonStr) as { text?: string; done?: boolean; error?: string };
          } catch {
            // Incomplete JSON in buffer — skip (handled by buffer accumulation)
            continue;
          }

          if (payload.text) {
            accumulatedText += payload.text;
            // Update last assistant message in state with streaming content
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: updated[lastIdx].content + payload.text,
                };
              }
              return updated;
            });
          } else if (payload.done) {
            setIsStreaming(false);

            // Parse app commands Claude may have appended (e.g. <app:navigate page="plan"/>)
            const cmdRegex = /<app:.*?\/>/g;
            const cmds = [...accumulatedText.matchAll(cmdRegex)].map(m => m[0]);

            // Strip commands from the displayed assistant message
            if (cmds.length > 0) {
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content.replace(cmdRegex, '').trim(),
                  };
                }
                return updated;
              });
            }

            // Execute session-complete commands first
            for (const cmd of cmds) {
              const m = cmd.match(/<app:complete session_id="([^"]+)"\/>/);
              if (m) {
                await fetch(`/api/sessions/${m[1]}`, {
                  method: 'PATCH',
                  headers: authHeaders(),
                  body: JSON.stringify({ completed: true }),
                });
              }
            }

            // Handle training plan generation (takes priority over navigate commands)
            if (accumulatedText.includes('<training_plan>')) {
              // Strip the raw <training_plan> block from the displayed message
              setMessages((prev) => {
                const updated = [...prev];
                const last = updated[updated.length - 1];
                if (last?.role === 'assistant') {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content.replace(/<training_plan>[\s\S]*?<\/training_plan>/g, '').trim(),
                  };
                }
                return updated;
              });

              const extractedGoal = extractGoalFromText(accumulatedText);
              try {
                const generateResponse = await fetch('/api/plan/generate', {
                  method: 'POST',
                  headers: authHeaders(),
                  body: JSON.stringify({
                    planId: plan._id,
                    claudeResponseText: accumulatedText,
                    goal: extractedGoal,
                  }),
                });

                if (generateResponse.ok) {
                  const updatedPlan = await fetchPlan();
                  if (updatedPlan) setPlan(updatedPlan);
                  navigate('/plan');
                } else {
                  const errData = await generateResponse.json().catch(() => ({ error: 'Plan generation failed' })) as { error?: string };
                  setError(errData.error ?? 'Something went wrong generating your plan');
                }
              } catch {
                setError('Something went wrong generating your plan');
              }
            } else {
              // Re-fetch plan to pick up any state changes (onboardingStep, completed sessions, etc.)
              const updatedPlan = await fetchPlan();
              if (updatedPlan) setPlan(updatedPlan);

              // Execute navigate commands after plan refresh so target page has fresh data
              for (const cmd of cmds) {
                const m = cmd.match(/<app:navigate page="([^"]+)"\/>/);
                if (m) {
                  navigate(m[1] === 'dashboard' ? '/' : `/${m[1]}`);
                  break; // only navigate once
                }
              }
            }
          } else if (payload.error) {
            setError(payload.error ?? 'An error occurred while streaming');
            setIsStreaming(false);
          }
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to send message';
      setError(message);
      setIsStreaming(false);
      // Remove empty placeholder if stream never started
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant' && last.content === '') {
          return prev.slice(0, -1);
        }
        return prev;
      });
    }
  }, [plan, fetchPlan, navigate]);

  const startPlan = useCallback(async (mode: 'conversational' | 'paste'): Promise<void> => {
    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ mode }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Failed to start plan' })) as { error?: string };
        setError(errData.error ?? 'Failed to start plan');
        return;
      }

      const data = await response.json() as { plan: PlanData };
      setPlan(data.plan);
      setMessages([]);

      if (mode === 'conversational') {
        // Kick off onboarding by sending an initial message
        // Use a direct send without waiting for plan state to settle
        const initMessage = "I'd like to start a new training plan";
        const userMessage: Message = {
          role: 'user',
          content: initMessage,
          timestamp: new Date().toISOString(),
        };
        setMessages([userMessage]);

        // Add placeholder for assistant response
        const assistantPlaceholder: Message = {
          role: 'assistant',
          content: '',
          timestamp: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, assistantPlaceholder]);
        setIsStreaming(true);

        try {
          const chatResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ planId: data.plan._id, message: initMessage }),
          });

          if (!chatResponse.ok) {
            setIsStreaming(false);
            setMessages((prev) => prev.slice(0, -1));
            return;
          }

          const reader = chatResponse.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let accumulatedText = '';

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              let payload: { text?: string; done?: boolean; error?: string };
              try {
                payload = JSON.parse(jsonStr) as { text?: string; done?: boolean; error?: string };
              } catch {
                continue;
              }

              if (payload.text) {
                accumulatedText += payload.text;
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: updated[lastIdx].content + payload.text,
                    };
                  }
                  return updated;
                });
              } else if (payload.done) {
                setIsStreaming(false);
                if (accumulatedText.includes('<training_plan>')) {
                  // Strip the raw <training_plan> block from the displayed message
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.role === 'assistant') {
                      updated[updated.length - 1] = {
                        ...last,
                        content: last.content.replace(/<training_plan>[\s\S]*?<\/training_plan>/g, '').trim(),
                      };
                    }
                    return updated;
                  });

                  const extractedGoal = extractGoalFromText(accumulatedText);
                  try {
                    const generateResponse = await fetch('/api/plan/generate', {
                      method: 'POST',
                      headers: authHeaders(),
                      body: JSON.stringify({
                        planId: data.plan._id,
                        claudeResponseText: accumulatedText,
                        goal: extractedGoal,
                      }),
                    });
                    if (generateResponse.ok) {
                      const updatedPlan = await fetchPlan();
                      if (updatedPlan) setPlan(updatedPlan);
                      navigate('/plan');
                    } else {
                      setError('Something went wrong generating your plan');
                    }
                  } catch {
                    setError('Something went wrong generating your plan');
                  }
                }
              } else if (payload.error) {
                setError(payload.error ?? 'An error occurred');
                setIsStreaming(false);
              }
            }
          }
        } catch {
          setIsStreaming(false);
        }
      }
      // For paste mode: don't auto-send; UI shows textarea for paste input
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to start plan';
      setError(message);
    }
  }, [fetchPlan, navigate]);

  // Start over returns to the welcome screen — the orphaned onboarding plan is discarded
  // automatically when the user starts a new plan via POST /api/plan.
  const startOver = useCallback((): void => {
    setPlan(null);
    setMessages([]);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    plan,
    isStreaming,
    isLoading,
    error,
    sendMessage,
    startPlan,
    startOver,
    clearError,
  };
}
