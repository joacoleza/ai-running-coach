import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type { PlanPhase, PlanGoal } from './usePlan';
import { useAuth } from '../contexts/AuthContext';

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
  sendMessage: (text: string) => Promise<string>;
  startPlan: (mode: 'conversational' | 'paste') => Promise<void>;
  startOver: () => void;
  clearError: () => void;
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

/** SSE payload shape emitted by the server */
type SSEPayload = { text?: string; done?: boolean; planGenerated?: boolean; error?: string };

/**
 * Shared SSE streaming helper. Reads chunks from `response.body`, decodes
 * them line-by-line, and dispatches to the caller-supplied callbacks.
 *
 * @param response  The fetch Response whose body contains the SSE stream.
 * @param opts.alive          Optional liveness guard — if it returns false the
 *                            reader is cancelled and streaming stops.
 * @param opts.onText         Called for every `payload.text` chunk with the
 *                            running accumulated text so far.
 * @param opts.onDone         Called once when `payload.done` arrives.
 * @param opts.onError        Called when `payload.error` arrives.
 * @returns The fully accumulated text string.
 */
async function streamChatResponse(
  response: Response,
  opts: {
    alive?: () => boolean;
    onText: (accumulatedText: string) => void;
    onDone: (accumulatedText: string, planGenerated: boolean) => Promise<void>;
    onError: (message: string) => void;
  }
): Promise<string> {
  const { alive, onText, onDone, onError } = opts;

  const reader = response.body!.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let accumulatedText = '';

  while (true) {
    if (alive && !alive()) { reader.cancel(); return accumulatedText; }
    const { value, done } = await reader.read();
    if (alive && !alive()) { reader.cancel(); return accumulatedText; }
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      if (alive && !alive()) return accumulatedText;
      if (!line.startsWith('data: ')) continue;
      const jsonStr = line.slice(6).trim();
      if (!jsonStr) continue;

      let payload: SSEPayload;
      try {
        payload = JSON.parse(jsonStr) as SSEPayload;
      } catch {
        // Incomplete JSON — skip
        continue;
      }

      if (payload.text) {
        accumulatedText += payload.text;
        onText(accumulatedText);
      } else if (payload.done) {
        await onDone(accumulatedText, payload.planGenerated ?? false);
        return accumulatedText;
      } else if (payload.error) {
        onError(payload.error);
        return accumulatedText;
      }
    }
  }

  return accumulatedText;
}


export function useChat(): UseChatReturn {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [isGeneratingPlan, setIsGeneratingPlan] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  function authHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
      'X-Authorization': `Bearer ${token ?? ''}`,
    };
  }

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
                        .replace(/<plan:update-phase[^/]*\/>/g, '')
                        .replace(/<plan:delete-phase[^/]*\/>/g, '')
                        .replace(/<plan:update[^/]*\/>/g, '')
                        .replace(/<plan:add[^/]*\/>/g, '')
                        .replace(/<plan:unlink[^/]*\/>/g, '')
                        .replace(/<plan:add-phase[^/]*\/>/g, '')
                        .replace(/<plan:add-week[^/]*\/>/g, '')
                        .replace(/<plan:delete-week[^/]*\/>/g, '')
                        .replace(/<plan:update-goal[^/]*\/>/g, '')
                        .replace(/<plan:update-feedback[\s\S]*?\/>/g, '')
                        .replace(/<run:create[^/]*\/>/g, '')
                        .replace(/<run:update-insight[^/]*\/>/g, '')
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

  // Re-fetch plan+messages when the page becomes visible and plan failed to load.
  // Handles: (1) Safari killing background fetches, (2) any startup fetch failure.
  useEffect(() => {
    const handler = async () => {
      if (document.visibilityState !== 'visible') return;
      if (plan !== null || isLoading) return;

      setIsLoading(true);
      try {
        const existingPlan = await fetchPlan();
        if (existingPlan && (existingPlan.status === 'onboarding' || existingPlan.status === 'active')) {
          setPlan(existingPlan);
          try {
            const msgRes = await fetch(`/api/messages?planId=${existingPlan._id}`, {
              headers: authHeaders(),
            });
            if (msgRes.ok) {
              const data = await msgRes.json() as { messages: Array<{ role: 'user' | 'assistant'; content: string; timestamp: string }> };
              if (data.messages.length > 0) {
                setMessages(data.messages.map((m) => ({
                  role: m.role,
                  content: m.role === 'assistant'
                    ? m.content
                        .replace(/<training_plan>[\s\S]*?<\/training_plan>/g, '')
                        .replace(/<plan:update-phase[^/]*\/>/g, '')
                        .replace(/<plan:delete-phase[^/]*\/>/g, '')
                        .replace(/<plan:update[^/]*\/>/g, '')
                        .replace(/<plan:add[^/]*\/>/g, '')
                        .replace(/<plan:unlink[^/]*\/>/g, '')
                        .replace(/<plan:add-phase[^/]*\/>/g, '')
                        .replace(/<plan:add-week[^/]*\/>/g, '')
                        .replace(/<plan:delete-week[^/]*\/>/g, '')
                        .replace(/<plan:update-goal[^/]*\/>/g, '')
                        .replace(/<plan:update-feedback[\s\S]*?\/>/g, '')
                        .replace(/<run:create[^/]*\/>/g, '')
                        .replace(/<run:update-insight[^/]*\/>/g, '')
                        .replace(/<app:[^/]*\/>/g, '')
                        .trim()
                    : m.content,
                  timestamp: typeof m.timestamp === 'string' ? m.timestamp : new Date(m.timestamp).toISOString(),
                })));
              }
            }
          } catch {
            // Non-fatal: messages will just start empty
          }
        }
      } finally {
        setIsLoading(false);
      }
    };

    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [plan, isLoading, fetchPlan]);

  /**
   * Apply plan:update / plan:add / phase-update / phase-delete tags found in
   * accumulatedText. Updates displayed message, calls APIs, refreshes plan state.
   * Shared between sendMessage and startPlan done handlers.
   */
  const applyPlanOperations = useCallback(async (
    accumulatedText: string,
    planUpdateDetected: boolean,
    aliveCheck?: () => boolean,
  ): Promise<void> => {
    const planUpdateRegex = /<plan:update\s+([^/]+)\/>/g;
    const planAddRegex = /<plan:add\s+([^/]+)\/>/g;
    const phaseUpdateRegex = /<plan:update-phase\s+([^/]+)\/>/g;
    const phaseDeleteRegex = /<plan:delete-phase\s*\/>/g;
    const planUnlinkRegex = /<plan:unlink\s+([^/]+)\/>/g;
    const addPhaseRegex = /<plan:add-phase\s*([^/]*)\/>/g;
    const addWeekRegex = /<plan:add-week\s+([^/]+)\/>/g;
    const deleteWeekRegex = /<plan:delete-week\s+([^/]+)\/>/g;
    const updateGoalRegex = /<plan:update-goal\s+([^/]+)\/>/g;
    const updateFeedbackRegex = /<plan:update-feedback\s+((?:(?!\/>)[\s\S])+)\/>/g;
    const runCreateRegex = /<run:create\s+([^/]+)\/>/g;
    const runInsightRegex = /<run:update-insight\s+([^/]+)\/>/g;
    const planUpdates = [...accumulatedText.matchAll(planUpdateRegex)];
    const planAdds = [...accumulatedText.matchAll(planAddRegex)];
    const phaseUpdates = [...accumulatedText.matchAll(phaseUpdateRegex)];
    const phaseDeletes = [...accumulatedText.matchAll(phaseDeleteRegex)];
    const planUnlinks = [...accumulatedText.matchAll(planUnlinkRegex)];
    const addPhaseMatches = [...accumulatedText.matchAll(addPhaseRegex)];
    const addWeekMatches = [...accumulatedText.matchAll(addWeekRegex)];
    const deleteWeekMatches = [...accumulatedText.matchAll(deleteWeekRegex)];
    const updateGoalMatches = [...accumulatedText.matchAll(updateGoalRegex)];
    const updateFeedbackMatches = [...accumulatedText.matchAll(updateFeedbackRegex)];
    const runCreateMatches = [...accumulatedText.matchAll(runCreateRegex)];
    const runInsightMatches = [...accumulatedText.matchAll(runInsightRegex)];

    if (planUpdates.length > 0 || planAdds.length > 0 || phaseUpdates.length > 0 || phaseDeletes.length > 0 || planUnlinks.length > 0
        || addPhaseMatches.length > 0 || addWeekMatches.length > 0 || deleteWeekMatches.length > 0 || updateGoalMatches.length > 0 || updateFeedbackMatches.length > 0
        || runCreateMatches.length > 0 || runInsightMatches.length > 0) {
      if (!aliveCheck || aliveCheck()) {
        // Strip tags from displayed message
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = {
              ...last,
              content: last.content
                .replace(/<plan:update-phase\s+([^/]+)\/>/g, '')
                .replace(/<plan:delete-phase\s*\/>/g, '')
                .replace(/<plan:update\s+([^/]+)\/>/g, '')
                .replace(/<plan:add\s+([^/]+)\/>/g, '')
                .replace(/<plan:unlink\s+([^/]+)\/>/g, '')
                .replace(/<plan:add-phase[^/]*\/>/g, '')
                .replace(/<plan:add-week[^/]*\/>/g, '')
                .replace(/<plan:delete-week[^/]*\/>/g, '')
                .replace(/<plan:update-goal[^/]*\/>/g, '')
                .replace(/<plan:update-feedback[\s\S]*?\/>/g, '')
                .replace(/<run:create[^/]*\/>/g, '')
                .replace(/<run:update-insight[^/]*\/>/g, '')
                .trim(),
            };
          }
          return updated;
        });
      }

      // Apply each update via PATCH — collect errors to surface in chat
      const updateErrors: string[] = [];
      for (const match of planUpdates) {
        if (aliveCheck && !aliveCheck()) return;
        const attrs = parseXmlAttrs(match[1]);
        if (attrs.week && attrs.day) {
          try {
            const res = await fetch(`/api/plan/days/${attrs.week}/${attrs.day}`, {
              method: 'PATCH',
              headers: authHeaders(),
              body: JSON.stringify(attrs),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({})) as { error?: string };
              updateErrors.push(body.error ?? `Could not update Week ${attrs.week} Day ${attrs.day}`);
            }
          } catch {
            // Non-fatal: individual day update failure doesn't block others
          }
        }
      }

      // Apply each add via POST — collect errors to surface in chat
      const addErrors: string[] = [];
      for (const match of planAdds) {
        if (aliveCheck && !aliveCheck()) return;
        const attrs = parseXmlAttrs(match[1]);
        if (attrs.week && attrs.day) {
          try {
            const res = await fetch('/api/plan/days', {
              method: 'POST',
              headers: { ...authHeaders(), 'Content-Type': 'application/json' },
              body: JSON.stringify({ weekNumber: Number(attrs.week), label: attrs.day, type: 'run', ...attrs }),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({})) as { error?: string };
              addErrors.push(body.error ?? `Could not add Week ${attrs.week} Day ${attrs.day}`);
            }
          } catch {
            // Network error — non-fatal
          }
        }
      }

      // Apply each phase update via PATCH
      const phaseUpdateErrors: string[] = [];
      for (const match of phaseUpdates) {
        if (aliveCheck && !aliveCheck()) return;
        const attrs = parseXmlAttrs(match[1]);
        if (attrs.index !== undefined) {
          const updates: { name?: string; description?: string } = {};
          if (attrs.name !== undefined) updates.name = attrs.name;
          if (attrs.description !== undefined) updates.description = attrs.description;
          try {
            const res = await fetch(`/api/plan/phases/${attrs.index}`, {
              method: 'PATCH',
              headers: authHeaders(),
              body: JSON.stringify(updates),
            });
            if (!res.ok) {
              const body = await res.json().catch(() => ({})) as { error?: string };
              phaseUpdateErrors.push(body.error ?? `Could not update phase ${attrs.index}`);
            }
          } catch {
            // Non-fatal
          }
        }
      }

      // Apply each phase delete via DELETE
      const phaseDeleteErrors: string[] = [];
      for (let i = 0; i < phaseDeletes.length; i++) {
        if (aliveCheck && !aliveCheck()) return;
        try {
          const res = await fetch('/api/plan/phases/last', {
            method: 'DELETE',
            headers: authHeaders(),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            phaseDeleteErrors.push(body.error ?? 'Could not delete last phase');
          }
        } catch {
          // Non-fatal
        }
      }

      // Apply each plan:unlink — find the run linked to week+day and unlink it
      const unlinkErrors: string[] = [];
      for (const match of planUnlinks) {
        if (aliveCheck && !aliveCheck()) return;
        const attrs = parseXmlAttrs(match[1]);
        const { week, day } = attrs;
        if (!week || !day) continue;
        try {
          const planRes = await fetch('/api/plan', { headers: authHeaders() });
          if (!planRes.ok) { unlinkErrors.push(`plan:unlink week=${week} day=${day}: could not fetch plan`); continue; }
          const planData = await planRes.json() as { _id: string };
          const runsRes = await fetch(`/api/runs?planId=${planData._id}&limit=500`, { headers: authHeaders() });
          if (!runsRes.ok) { unlinkErrors.push(`plan:unlink week=${week} day=${day}: could not fetch runs`); continue; }
          const runsData = await runsRes.json() as { runs: Array<{ _id: string; weekNumber?: number; dayLabel?: string }> };
          const linkedRun = runsData.runs.find(r => String(r.weekNumber) === week && r.dayLabel === day);
          if (!linkedRun) { unlinkErrors.push(`plan:unlink week=${week} day=${day}: no linked run found`); continue; }
          const unlinkRes = await fetch(`/api/runs/${linkedRun._id}/unlink`, { method: 'POST', headers: authHeaders() });
          if (!unlinkRes.ok) {
            const errBody = await unlinkRes.json().catch(() => ({ error: 'unlink failed' })) as { error?: string };
            unlinkErrors.push(`plan:unlink week=${week} day=${day}: ${errBody.error ?? 'failed'}`);
          }
        } catch (e) {
          unlinkErrors.push(`plan:unlink week=${week} day=${day}: ${e instanceof Error ? e.message : 'error'}`);
        }
      }

      // Add a new phase
      const addPhaseErrors: string[] = [];
      for (const match of addPhaseMatches) {
        if (aliveCheck && !aliveCheck()) return;
        const attrs = parseXmlAttrs(match[1]);
        try {
          const res = await fetch('/api/plan/phases', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ name: attrs.name, description: attrs.description }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            addPhaseErrors.push(body.error ?? 'Could not add phase');
          }
        } catch {
          addPhaseErrors.push('plan:add-phase: network error');
        }
      }

      // Add a week to an existing phase
      const addWeekErrors: string[] = [];
      for (const match of addWeekMatches) {
        if (aliveCheck && !aliveCheck()) return;
        const attrs = parseXmlAttrs(match[1]);
        const phaseIndex = attrs.phaseIndex;
        if (phaseIndex === undefined) {
          addWeekErrors.push('plan:add-week: phaseIndex is required');
          continue;
        }
        try {
          const res = await fetch(`/api/plan/phases/${phaseIndex}/weeks`, {
            method: 'POST',
            headers: authHeaders(),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            addWeekErrors.push(body.error ?? `Could not add week to phase ${phaseIndex}`);
          }
        } catch {
          addWeekErrors.push(`plan:add-week: network error for phase ${phaseIndex}`);
        }
      }

      // Delete the last week of a phase
      const deleteWeekErrors: string[] = [];
      for (const match of deleteWeekMatches) {
        if (aliveCheck && !aliveCheck()) return;
        const attrs = parseXmlAttrs(match[1]);
        const phaseIndex = attrs.phaseIndex;
        if (phaseIndex === undefined) {
          deleteWeekErrors.push('plan:delete-week: phaseIndex is required');
          continue;
        }
        try {
          const res = await fetch(`/api/plan/phases/${phaseIndex}/weeks/last`, {
            method: 'DELETE',
            headers: authHeaders(),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            deleteWeekErrors.push(body.error ?? `Could not delete last week from phase ${phaseIndex}`);
          }
        } catch {
          deleteWeekErrors.push(`plan:delete-week: network error for phase ${phaseIndex}`);
        }
      }

      // Update plan goal / target date
      const updateGoalErrors: string[] = [];
      for (const match of updateGoalMatches) {
        if (aliveCheck && !aliveCheck()) return;
        const attrs = parseXmlAttrs(match[1]);
        try {
          const res = await fetch('/api/plan', {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ targetDate: attrs.targetDate ?? '' }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            updateGoalErrors.push(body.error ?? 'Could not update goal');
          }
        } catch {
          updateGoalErrors.push('plan:update-goal: network error');
        }
      }

      // Save plan progress feedback (from organic "how am I doing?" coach responses)
      const updateFeedbackErrors: string[] = [];
      for (const match of updateFeedbackMatches) {
        if (aliveCheck && !aliveCheck()) return;
        const attrs = parseXmlAttrs(match[1]);
        if (!attrs.feedback) continue;
        try {
          const res = await fetch('/api/plan', {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ progressFeedback: attrs.feedback }),
          });
          if (!res.ok) {
            const body = await res.json().catch(() => ({})) as { error?: string };
            updateFeedbackErrors.push(body.error ?? 'Could not save plan feedback');
          }
        } catch {
          updateFeedbackErrors.push('plan:update-feedback: network error');
        }
      }

      // Create a run on behalf of the user (unit attr intentionally not forwarded)
      const runCreateErrors: string[] = [];
      for (const match of runCreateMatches) {
        if (aliveCheck && !aliveCheck()) return;
        const attrs = parseXmlAttrs(match[1]);
        if (!attrs.date || !attrs.distance || !attrs.duration) {
          runCreateErrors.push('run:create: date, distance, and duration are required');
          continue;
        }
        const body: Record<string, unknown> = {
          date: attrs.date,
          distance: Number(attrs.distance),
          duration: attrs.duration,
        };
        if (attrs.avgHR) body.avgHR = Number(attrs.avgHR);
        if (attrs.notes) body.notes = attrs.notes;
        if (attrs.weekNumber && attrs.dayLabel) {
          body.weekNumber = Number(attrs.weekNumber);
          body.dayLabel = attrs.dayLabel;
        }
        // attrs.unit intentionally NOT forwarded — POST /api/runs does not accept it
        try {
          const res = await fetch('/api/runs', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify(body),
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({})) as { error?: string };
            runCreateErrors.push(errBody.error ?? 'Could not create run');
          } else {
            // Auto-save the coaching response as insight for the newly created run.
            // run:update-insight requires a runId that doesn't exist during generation,
            // so we capture the _id from the POST response and save insight immediately.
            const created = await res.json().catch(() => ({})) as { _id?: string };
            if (created._id) {
              const insightText = accumulatedText
                .replace(/<plan:update-phase[^/]*\/>/g, '')
                .replace(/<plan:delete-phase[^/]*\/>/g, '')
                .replace(/<plan:update[^/]*\/>/g, '')
                .replace(/<plan:add[^/]*\/>/g, '')
                .replace(/<plan:unlink[^/]*\/>/g, '')
                .replace(/<plan:add-phase[^/]*\/>/g, '')
                .replace(/<plan:add-week[^/]*\/>/g, '')
                .replace(/<plan:delete-week[^/]*\/>/g, '')
                .replace(/<plan:update-goal[^/]*\/>/g, '')
                .replace(/<plan:update-feedback[\s\S]*?\/>/g, '')
                .replace(/<run:create[^/]*\/>/g, '')
                .replace(/<run:update-insight[^/]*\/>/g, '')
                .replace(/<app:[^/]*\/>/g, '')
                .trim();
              await fetch(`/api/runs/${created._id}`, {
                method: 'PATCH',
                headers: authHeaders(),
                body: JSON.stringify({ insight: insightText }),
              }).catch(() => { /* non-fatal */ });
            }
          }
        } catch {
          runCreateErrors.push('run:create: network error');
        }
      }

      // Save coaching insight to a specific run (silent, no plan refresh)
      const runInsightErrors: string[] = [];
      for (const match of runInsightMatches) {
        if (aliveCheck && !aliveCheck()) return;
        const attrs = parseXmlAttrs(match[1]);
        if (!attrs.runId || !attrs.insight) {
          runInsightErrors.push('run:update-insight: runId and insight are required');
          continue;
        }
        try {
          const res = await fetch(`/api/runs/${attrs.runId}`, {
            method: 'PATCH',
            headers: authHeaders(),
            body: JSON.stringify({ insight: attrs.insight }),
          });
          if (!res.ok) {
            const errBody = await res.json().catch(() => ({})) as { error?: string };
            runInsightErrors.push(errBody.error ?? `Could not update insight for run ${attrs.runId}`);
          }
        } catch {
          runInsightErrors.push(`run:update-insight ${attrs.runId}: network error`);
        }
      }

      const allErrors = [...updateErrors, ...addErrors, ...phaseUpdateErrors, ...phaseDeleteErrors, ...unlinkErrors, ...addPhaseErrors, ...addWeekErrors, ...deleteWeekErrors, ...updateGoalErrors, ...updateFeedbackErrors, ...runCreateErrors, ...runInsightErrors];
      if (allErrors.length > 0 && (!aliveCheck || aliveCheck())) {
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + `\n\n⚠️ ${allErrors.join('; ')}` };
          }
          return updated;
        });
      }

      // Re-fetch plan after all updates applied and notify the plan page.
      // Skip plan-updated dispatch if ONLY insight tags were processed (no structural plan changes).
      const hasPlanMutation = planUpdates.length > 0 || planAdds.length > 0 || phaseUpdates.length > 0
        || phaseDeletes.length > 0 || planUnlinks.length > 0
        || addPhaseMatches.length > 0 || addWeekMatches.length > 0 || deleteWeekMatches.length > 0 || updateGoalMatches.length > 0 || updateFeedbackMatches.length > 0 || runCreateMatches.length > 0;

      const refreshedPlan = await fetchPlan();
      if (aliveCheck && !aliveCheck()) return;
      if (refreshedPlan) setPlan(refreshedPlan);
      if (hasPlanMutation) window.dispatchEvent(new Event('plan-updated'));
      setIsGeneratingPlan(false);
    } else if (planUpdateDetected) {
      // Tags were detected during streaming but not in accumulated text (edge case) — reset
      setIsGeneratingPlan(false);
    }
  }, [fetchPlan]);

  const sendMessage = useCallback(async (text: string): Promise<string> => {
    if (!plan) return '';

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
        return '';
      }

      let planUpdateDetected = false;

      const accumulatedText = await streamChatResponse(response, {
        onText: (acc) => {
          // Show plan-update indicator as soon as plan modification tags are detected
          if (!planUpdateDetected && (acc.includes('<plan:update') || acc.includes('<plan:add') || acc.includes('<plan:update-phase') || acc.includes('<plan:delete-phase') || acc.includes('<plan:add-phase') || acc.includes('<plan:add-week') || acc.includes('<plan:delete-week') || acc.includes('<plan:update-feedback') || acc.includes('<run:create'))) {
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
                content: acc
                  .replace(/<training_plan>[\s\S]*/g, '')
                  .replace(/<plan:update-phase[^/]*\/>/g, '')
                  .replace(/<plan:delete-phase[^/]*\/>/g, '')
                  .replace(/<plan:update[^/]*\/>/g, '')
                  .replace(/<plan:add[^/]*\/>/g, '')
                  .replace(/<plan:unlink[^/]*\/>/g, '')
                  .replace(/<plan:add-phase[^/]*\/>/g, '')
                  .replace(/<plan:add-week[^/]*\/>/g, '')
                  .replace(/<plan:delete-week[^/]*\/>/g, '')
                  .replace(/<plan:update-goal[^/]*\/>/g, '')
                  .replace(/<plan:update-feedback[\s\S]*?\/>/g, '')
                  .replace(/<run:create[^/]*\/>/g, '')
                  .replace(/<run:update-insight[^/]*\/>/g, '')
                  .trim(),
              };
            }
            return updated;
          });
        },
        onDone: async (acc, planGenerated) => {
          setIsStreaming(false);

          // Parse app commands Claude may have appended (e.g. <app:navigate page="plan"/>)
          const cmdRegex = /<app:.*?\/>/g;
          const cmds = [...acc.matchAll(cmdRegex)].map(m => m[0]);

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
          if (planGenerated || acc.includes('<training_plan>')) {
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

            // Handle <plan:update>, <plan:add>, phase ops
            await applyPlanOperations(acc, planUpdateDetected);

            // Execute navigate commands after plan refresh so target page has fresh data
            for (const cmd of cmds) {
              const m = cmd.match(/<app:navigate page="([^"]+)"\/>/);
              if (m) {
                navigate(m[1] === 'dashboard' ? '/' : `/${m[1]}`);
                break; // only navigate once
              }
            }
          }
        },
        onError: (msg) => {
          setError(msg);
          setIsStreaming(false);
        },
      });

      return accumulatedText;
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
      return '';
    }
  }, [plan, fetchPlan, navigate, applyPlanOperations]);

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
          const chatResponse = await fetch('/api/chat', {
            method: 'POST',
            headers: authHeaders(),
            body: JSON.stringify({ planId: data.plan._id, message: initMessage }),
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

          let planUpdateDetected = false;

          await streamChatResponse(chatResponse, {
            alive,
            onText: (acc) => {
              // Show plan-update indicator as soon as plan modification tags are detected
              if (!planUpdateDetected && (acc.includes('<plan:update') || acc.includes('<plan:add') || acc.includes('<plan:update-phase') || acc.includes('<plan:delete-phase') || acc.includes('<plan:add-phase') || acc.includes('<plan:add-week') || acc.includes('<plan:delete-week') || acc.includes('<plan:update-feedback') || acc.includes('<run:create'))) {
                planUpdateDetected = true;
                if (alive()) setIsGeneratingPlan(true);
              }
              if (alive()) {
                setMessages((prev) => {
                  const updated = [...prev];
                  const lastIdx = updated.length - 1;
                  if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                    updated[lastIdx] = {
                      ...updated[lastIdx],
                      content: acc
                        .replace(/<training_plan>[\s\S]*/g, '')
                        .replace(/<plan:update-phase[^/]*\/>/g, '')
                        .replace(/<plan:delete-phase[^/]*\/>/g, '')
                        .replace(/<plan:update[^/]*\/>/g, '')
                        .replace(/<plan:add[^/]*\/>/g, '')
                        .replace(/<plan:unlink[^/]*\/>/g, '')
                        .replace(/<plan:add-phase[^/]*\/>/g, '')
                        .replace(/<plan:add-week[^/]*\/>/g, '')
                        .replace(/<plan:delete-week[^/]*\/>/g, '')
                        .replace(/<plan:update-goal[^/]*\/>/g, '')
                        .replace(/<plan:update-feedback[\s\S]*?\/>/g, '')
                        .replace(/<run:create[^/]*\/>/g, '')
                        .replace(/<run:update-insight[^/]*\/>/g, '')
                        .trim(),
                    };
                  }
                  return updated;
                });
              }
            },
            onDone: async (acc, planGenerated) => {
              if (!alive()) return;
              setIsStreaming(false);

              if (planGenerated || acc.includes('<training_plan>')) {
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

                // Handle <plan:update>, <plan:add>, phase ops
                await applyPlanOperations(acc, planUpdateDetected, alive);
              }
            },
            onError: (msg) => {
              if (alive()) { setError(msg); setIsStreaming(false); }
            },
          });
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
  }, [fetchPlan, navigate, applyPlanOperations]);

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
