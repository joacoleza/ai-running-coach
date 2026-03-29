import { useState, useEffect, useRef, useCallback } from 'react';
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
  isGeneratingPlan: boolean;
  isLoading: boolean;
  isBusy: boolean;
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

/**
 * Parse key="value" attribute pairs from an XML attribute string.
 * Exported for unit testing.
 */
export function parseXmlAttrs(attrString: string): Record<string, string> {
  const result: Record<string, string> = {};
  const attrRegex = /(\w+)="([^"]*)"/g;
  for (const m of attrString.matchAll(attrRegex)) {
    result[m[1]] = m[2];
  }
  return result;
}


export function useChat(): UseChatReturn {
  const [messages, setMessages] = useState<Message[]>([]);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  /**
   * Session ID pattern: each startPlan/startOver call increments this counter.
   * Every async continuation captures the ID at start and checks alive() before
   * applying state updates. This prevents stale in-flight operations from
   * corrupting state after startOver or a new startPlan call.
   */
  const sessionIdRef = useRef(0);

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

  // Listen for plan-archived event to reset state
  useEffect(() => {
    const handler = () => {
      sessionIdRef.current++; // Invalidate any in-flight operations
      setPlan(null);
      setMessages([]);
      setIsStreaming(false);
      setIsGeneratingPlan(false);
      setIsBusy(false);
    };
    window.addEventListener('plan-archived', handler);
    return () => window.removeEventListener('plan-archived', handler);
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
                  content: m.role === 'assistant'
                    ? m.content
                        .replace(/<training_plan>[\s\S]*?<\/training_plan>/g, '')
                        .replace(/<plan:update[^/]*\/>/g, '')
                        .replace(/<plan:add[^/]*\/>/g, '')
                        .replace(/<app:[^/]*\/>/g, '')
                        .trim()
                    : m.content,
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
      const localDate = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ planId: plan._id, message: text, currentDate: localDate }),
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
      let planUpdateDetected = false;

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

          let payload: { text?: string; done?: boolean; planGenerated?: boolean; error?: string };
          try {
            payload = JSON.parse(jsonStr) as { text?: string; done?: boolean; planGenerated?: boolean; error?: string };
          } catch {
            // Incomplete JSON in buffer — skip (handled by buffer accumulation)
            continue;
          }

          if (payload.text) {
            accumulatedText += payload.text;
            // Show plan-update indicator as soon as plan modification tags are detected
            if (!planUpdateDetected && (accumulatedText.includes('<plan:update') || accumulatedText.includes('<plan:add'))) {
              planUpdateDetected = true;
              setIsGeneratingPlan(true);
            }
            // Update last assistant message in state with streaming content.
            // Strip machine-data tags from display as they arrive.
            setMessages((prev) => {
              const updated = [...prev];
              const lastIdx = updated.length - 1;
              if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                updated[lastIdx] = {
                  ...updated[lastIdx],
                  content: accumulatedText
                    .replace(/<training_plan>[\s\S]*/g, '')
                    .replace(/<plan:update[^/]*\/>/g, '')
                    .replace(/<plan:add[^/]*\/>/g, '')
                    .trim(),
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

            // Handle training plan generation — plan was saved server-side, just re-fetch
            if (payload.planGenerated || accumulatedText.includes('<training_plan>')) {
              setIsGeneratingPlan(true);
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

              try {
                const updatedPlan = await fetchPlan();
                if (updatedPlan) setPlan(updatedPlan);
                window.dispatchEvent(new Event('plan-updated'));
                setIsGeneratingPlan(false);
                navigate('/plan');
              } catch {
                setIsGeneratingPlan(false);
                setError('Something went wrong generating your plan');
              }
            } else {
              // Re-fetch plan to pick up any state changes (onboardingStep, etc.)
              const updatedPlan = await fetchPlan();
              if (updatedPlan) setPlan(updatedPlan);

              // Handle <plan:update> and <plan:add> tags -- strip from display and apply via API
              const planUpdateRegex = /<plan:update\s+([^/]+)\/>/g;
              const planAddRegex = /<plan:add\s+([^/]+)\/>/g;
              const planUpdates = [...accumulatedText.matchAll(planUpdateRegex)];
              const planAdds = [...accumulatedText.matchAll(planAddRegex)];

              if (planUpdates.length > 0 || planAdds.length > 0) {
                // Strip tags from displayed message
                setMessages((prev) => {
                  const updated = [...prev];
                  const last = updated[updated.length - 1];
                  if (last?.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content
                        .replace(planUpdateRegex, '')
                        .replace(planAddRegex, '')
                        .trim(),
                    };
                  }
                  return updated;
                });

                // Apply each update via PATCH — collect errors to surface in chat
                const updateErrors: string[] = [];
                for (const match of planUpdates) {
                  const attrs = parseXmlAttrs(match[1]);
                  if (attrs.date) {
                    try {
                      const res = await fetch(`/api/plan/days/${attrs.date}`, {
                        method: 'PATCH',
                        headers: authHeaders(),
                        body: JSON.stringify(attrs),
                      });
                      if (!res.ok) {
                        const body = await res.json().catch(() => ({}));
                        updateErrors.push(body.error ?? `Could not update day ${attrs.date}`);
                      }
                    } catch {
                      // Non-fatal: individual day update failure doesn't block others
                    }
                  }
                }

                // Apply each add via POST — collect errors to surface in chat
                const addErrors: string[] = [];
                for (const match of planAdds) {
                  const attrs = parseXmlAttrs(match[1]);
                  if (attrs.date) {
                    try {
                      const res = await fetch('/api/plan/days', {
                        method: 'POST',
                        headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                        body: JSON.stringify({ type: 'run', ...attrs }),
                      });
                      if (!res.ok) {
                        const body = await res.json().catch(() => ({}));
                        addErrors.push(body.error ?? `Could not add day ${attrs.date}`);
                      }
                    } catch {
                      // Network error — non-fatal
                    }
                  }
                }
                const allErrors = [...updateErrors, ...addErrors];
                if (allErrors.length > 0) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const last = updated[updated.length - 1];
                    if (last?.role === 'assistant') {
                      updated[updated.length - 1] = { ...last, content: last.content + `\n\n⚠️ ${allErrors.join('; ')}` };
                    }
                    return updated;
                  });
                }

                // Re-fetch plan after all updates applied and notify the plan page
                const refreshedPlan = await fetchPlan();
                if (refreshedPlan) setPlan(refreshedPlan);
                window.dispatchEvent(new Event('plan-updated'));
                setIsGeneratingPlan(false);
              } else if (planUpdateDetected) {
                // Tags were detected during streaming but not in accumulated text (edge case) — reset
                setIsGeneratingPlan(false);
              }

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
    // Capture session ID — startOver increments this, making stale continuations no-ops
    const sid = ++sessionIdRef.current;
    const alive = () => sessionIdRef.current === sid;

    setIsBusy(true);
    setError(null);

    try {
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({ mode }),
      });

      if (!alive()) return;

      if (!response.ok) {
        const errData = await response.json().catch(() => ({ error: 'Failed to start plan' })) as { error?: string };
        if (alive()) { setError(errData.error ?? 'Failed to start plan'); setIsBusy(false); }
        return;
      }

      const data = await response.json() as { plan: PlanData };
      if (!alive()) return;

      setPlan(data.plan);
      setMessages([]);

      if (mode === 'conversational') {
        // Kick off onboarding by sending an initial message
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
        setIsBusy(false);

        try {
          const localDate2 = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; })();
          const chatResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ planId: data.plan._id, message: initMessage, currentDate: localDate2 }),
          });

          if (!alive()) return;

          if (!chatResponse.ok) {
            const errData = await chatResponse.json().catch(() => ({ error: 'Failed to connect to the coach' })) as { error?: string };
            if (alive()) {
              setIsStreaming(false);
              setError(errData.error ?? 'Failed to connect to the coach');
              setMessages((prev) => prev.slice(0, -1));
            }
            return;
          }

          const reader = chatResponse.body!.getReader();
          const decoder = new TextDecoder();
          let buffer = '';
          let accumulatedText = '';
          let planUpdateDetected2 = false;

          while (true) {
            const { value, done } = await reader.read();
            if (!alive()) { reader.cancel(); return; }
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
              if (!alive()) return;
              if (!line.startsWith('data: ')) continue;
              const jsonStr = line.slice(6).trim();
              if (!jsonStr) continue;

              let payload: { text?: string; done?: boolean; planGenerated?: boolean; error?: string };
              try {
                payload = JSON.parse(jsonStr) as { text?: string; done?: boolean; planGenerated?: boolean; error?: string };
              } catch {
                continue;
              }

              if (payload.text) {
                accumulatedText += payload.text;
                // Show plan-update indicator as soon as plan modification tags are detected
                if (!planUpdateDetected2 && (accumulatedText.includes('<plan:update') || accumulatedText.includes('<plan:add'))) {
                  planUpdateDetected2 = true;
                  if (alive()) setIsGeneratingPlan(true);
                }
                if (alive()) {
                  setMessages((prev) => {
                    const updated = [...prev];
                    const lastIdx = updated.length - 1;
                    if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                      updated[lastIdx] = {
                        ...updated[lastIdx],
                        content: accumulatedText
                          .replace(/<training_plan>[\s\S]*/g, '')
                          .replace(/<plan:update[^/]*\/>/g, '')
                          .replace(/<plan:add[^/]*\/>/g, '')
                          .trim(),
                      };
                    }
                    return updated;
                  });
                }
              } else if (payload.done) {
                if (!alive()) return;
                setIsStreaming(false);
                if (payload.planGenerated || accumulatedText.includes('<training_plan>')) {
                  setIsGeneratingPlan(true);
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

                  try {
                    const updatedPlan = await fetchPlan();
                    if (!alive()) return;
                    if (updatedPlan) setPlan(updatedPlan);
                    window.dispatchEvent(new Event('plan-updated'));
                    setIsGeneratingPlan(false);
                    navigate('/plan');
                  } catch {
                    if (alive()) { setIsGeneratingPlan(false); setError('Something went wrong generating your plan'); }
                  }
                } else {
                  const updatedPlan = await fetchPlan();
                  if (!alive()) return;
                  if (updatedPlan) setPlan(updatedPlan);

                  const planUpdateRegex = /<plan:update\s+([^/]+)\/>/g;
                  const planAddRegex = /<plan:add\s+([^/]+)\/>/g;
                  const planUpdates = [...accumulatedText.matchAll(planUpdateRegex)];
                  const planAdds = [...accumulatedText.matchAll(planAddRegex)];

                  if (planUpdates.length > 0 || planAdds.length > 0) {
                    if (alive()) {
                      setMessages((prev) => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        if (last?.role === 'assistant') {
                          updated[updated.length - 1] = {
                            ...last,
                            content: last.content
                              .replace(planUpdateRegex, '')
                              .replace(planAddRegex, '')
                              .trim(),
                          };
                        }
                        return updated;
                      });
                    }

                    const updateErrors2: string[] = [];
                    for (const match of planUpdates) {
                      if (!alive()) return;
                      const attrs = parseXmlAttrs(match[1]);
                      if (attrs.date) {
                        try {
                          const res = await fetch(`/api/plan/days/${attrs.date}`, {
                            method: 'PATCH',
                            headers: authHeaders(),
                            body: JSON.stringify(attrs),
                          });
                          if (!res.ok) {
                            const body = await res.json().catch(() => ({}));
                            updateErrors2.push(body.error ?? `Could not update day ${attrs.date}`);
                          }
                        } catch {
                          // Non-fatal
                        }
                      }
                    }

                    const addErrors2: string[] = [];
                    for (const match of planAdds) {
                      if (!alive()) return;
                      const attrs = parseXmlAttrs(match[1]);
                      if (attrs.date) {
                        try {
                          const res = await fetch('/api/plan/days', {
                            method: 'POST',
                            headers: { ...authHeaders(), 'Content-Type': 'application/json' },
                            body: JSON.stringify({ type: 'run', ...attrs }),
                          });
                          if (!res.ok) {
                            const body = await res.json().catch(() => ({}));
                            addErrors2.push(body.error ?? `Could not add day ${attrs.date}`);
                          }
                        } catch {
                          // Network error — non-fatal
                        }
                      }
                    }
                    const allErrors2 = [...updateErrors2, ...addErrors2];
                    if (allErrors2.length > 0 && alive()) {
                      setMessages((prev) => {
                        const updated = [...prev];
                        const last = updated[updated.length - 1];
                        if (last?.role === 'assistant') {
                          updated[updated.length - 1] = { ...last, content: last.content + `\n\n⚠️ ${allErrors2.join('; ')}` };
                        }
                        return updated;
                      });
                    }

                    const refreshedPlan = await fetchPlan();
                    if (!alive()) return;
                    if (refreshedPlan) setPlan(refreshedPlan);
                    window.dispatchEvent(new Event('plan-updated'));
                    if (alive()) setIsGeneratingPlan(false);
                  } else if (planUpdateDetected2) {
                    // Tags were detected during streaming but not in accumulated text (edge case) — reset
                    if (alive()) setIsGeneratingPlan(false);
                  }
                }
              } else if (payload.error) {
                if (alive()) { setError(payload.error ?? 'An error occurred'); setIsStreaming(false); }
              }
            }
          }
        } catch (err) {
          if (alive()) {
            const message = err instanceof Error ? err.message : 'Failed to connect to the coach';
            setError(message);
            setIsStreaming(false);
            setMessages((prev) => {
              const last = prev[prev.length - 1];
              if (last?.role === 'assistant' && last.content === '') {
                return prev.slice(0, -1);
              }
              return prev;
            });
          }
        }
      } else {
        // paste mode: just set busy=false, UI handles input
        setIsBusy(false);
      }
    } catch (err) {
      if (alive()) {
        const message = err instanceof Error ? err.message : 'Failed to start plan';
        setError(message);
        setIsBusy(false);
      }
    }
  }, [fetchPlan, navigate]);

  // Start over returns to the welcome screen — the orphaned onboarding plan is discarded
  // automatically when the user starts a new plan via POST /api/plan.
  const startOver = useCallback((): void => {
    sessionIdRef.current++; // Invalidate any in-flight startPlan operations
    setPlan(null);
    setMessages([]);
    setIsStreaming(false);
    setIsGeneratingPlan(false);
    setIsBusy(false);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    messages,
    plan,
    isStreaming,
    isGeneratingPlan,
    isLoading,
    isBusy,
    error,
    sendMessage,
    startPlan,
    startOver,
    clearError,
  };
}
