import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import React from 'react';
import { useChat } from '../hooks/useChat';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(MemoryRouter, null, children);

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.setItem('app_password', 'test-pw');
  // Default: no existing plan on mount
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ plan: null }) });
});

describe('useChat — startOver', () => {
  it('startOver resets plan, messages, isStreaming, isGeneratingPlan, and error', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => {
      result.current.startOver();
    });

    expect(result.current.plan).toBeNull();
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.isStreaming).toBe(false);
    expect(result.current.isGeneratingPlan).toBe(false);
    expect(result.current.isBusy).toBe(false);
    expect(result.current.error).toBeNull();
  });
});

describe('useChat — isBusy', () => {
  it('isBusy is false initially', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.isBusy).toBe(false);
  });

  it('startOver called during startPlan prevents stale state updates', async () => {
    // First call: POST /api/plan
    let resolvePost!: (v: unknown) => void;
    const postPromise = new Promise(r => { resolvePost = r; });

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: null }) }) // mount
      .mockReturnValueOnce(postPromise); // POST /api/plan — held

    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    // Start plan (in flight, not yet resolved)
    void act(() => { void result.current.startPlan('conversational'); });

    // Call startOver before the POST resolves
    act(() => { result.current.startOver(); });

    // Now resolve the POST — should be ignored
    await act(async () => {
      resolvePost({
        ok: true,
        json: async () => ({ plan: { _id: 'p1', status: 'onboarding', phases: [], onboardingMode: 'conversational', onboardingStep: 0, goal: {} } }),
        body: null,
      });
    });

    // Plan should remain null — startOver won
    expect(result.current.plan).toBeNull();
    expect(result.current.isBusy).toBe(false);
  });
});

describe('useChat — startPlan error handling', () => {
  const planPayload = {
    _id: 'p1',
    status: 'onboarding',
    phases: [],
    onboardingMode: 'conversational',
    onboardingStep: 0,
    goal: {},
  };

  it('shows error and removes placeholder when chat response is not ok', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: null }) }) // mount
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: planPayload }) }) // POST /api/plan
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Coach unavailable' }) }); // POST /api/chat

    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.startPlan('conversational'); });

    expect(result.current.error).toBe('Coach unavailable');
    expect(result.current.isStreaming).toBe(false);
    // Placeholder assistant message should be removed
    expect(result.current.messages.every(m => m.content !== '' || m.role !== 'assistant')).toBe(true);
  });

  it('shows error and removes empty placeholder when stream throws', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: null }) }) // mount
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: planPayload }) }) // POST /api/plan
      .mockResolvedValueOnce({
        ok: true,
        body: {
          getReader() {
            return {
              read() { return Promise.reject(new Error('Network failure')); },
              cancel() { return Promise.resolve(); },
            };
          },
        },
      }); // POST /api/chat — stream throws

    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.startPlan('conversational'); });

    expect(result.current.error).toBe('Network failure');
    expect(result.current.isStreaming).toBe(false);
    // Empty placeholder must not linger
    const emptyAssistant = result.current.messages.filter(m => m.role === 'assistant' && m.content === '');
    expect(emptyAssistant).toHaveLength(0);
  });

  it('shows generic error when chat response has no error body', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: null }) }) // mount
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: planPayload }) }) // POST /api/plan
      .mockResolvedValueOnce({ ok: false, json: async () => ({}) }); // POST /api/chat — no error field

    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => { await result.current.startPlan('conversational'); });

    expect(result.current.error).toBe('Failed to connect to the coach');
  });

});

describe('useChat — history stripping on mount', () => {
  const activePlan = { _id: 'p1', status: 'active', phases: [], onboardingMode: 'conversational', onboardingStep: 0, goal: {} };

  it('strips <training_plan> XML from assistant messages loaded from history', async () => {
    const rawContent = 'Great! Here is your plan.\n\n<training_plan>{"phases":[]}</training_plan>';
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: activePlan }) }) // mount plan
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ role: 'assistant', content: rawContent, timestamp: new Date().toISOString() }] }) }); // messages

    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const assistantMsg = result.current.messages.find(m => m.role === 'assistant');
    expect(assistantMsg?.content).toBe('Great! Here is your plan.');
    expect(assistantMsg?.content).not.toContain('<training_plan>');
  });

  it('strips <plan:update> tags from assistant messages loaded from history', async () => {
    const rawContent = 'Updated May 12th.\n\n<plan:update date="2025-05-12" objective_kind="time" objective_value="30" objective_unit="min" />\n\nDone!';
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: activePlan }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ role: 'assistant', content: rawContent, timestamp: new Date().toISOString() }] }) });

    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const assistantMsg = result.current.messages.find(m => m.role === 'assistant');
    expect(assistantMsg?.content).not.toContain('<plan:update');
    expect(assistantMsg?.content).toContain('Updated May 12th.');
    expect(assistantMsg?.content).toContain('Done!');
  });

  it('strips <app:*> commands from assistant messages loaded from history', async () => {
    const rawContent = 'Navigating you to the plan. <app:navigate page="plan"/>';
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: activePlan }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ role: 'assistant', content: rawContent, timestamp: new Date().toISOString() }] }) });

    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const assistantMsg = result.current.messages.find(m => m.role === 'assistant');
    expect(assistantMsg?.content).not.toContain('<app:');
    expect(assistantMsg?.content).toContain('Navigating you to the plan.');
  });

  it('does not strip content from user messages', async () => {
    const userContent = 'Update the 12 may entry, it should be a 30 min run';
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: activePlan }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [{ role: 'user', content: userContent, timestamp: new Date().toISOString() }] }) });

    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const userMsg = result.current.messages.find(m => m.role === 'user');
    expect(userMsg?.content).toBe(userContent);
  });
});

describe('useChat — plan-updated dispatch after plan:update patches', () => {
  const activePlan = { _id: 'p1', status: 'active', phases: [], onboardingMode: 'conversational', onboardingStep: 0, goal: {} };

  function makeSseStream(events: string[]): ReadableStream<Uint8Array> {
    return new ReadableStream({
      start(controller) {
        const enc = new TextEncoder();
        for (const e of events) controller.enqueue(enc.encode(e));
        controller.close();
      },
    });
  }

  it('dispatches plan-updated after applying plan:update patches', async () => {
    const patchedPlan = { ...activePlan, _id: 'p1-patched' };
    const sseBody = makeSseStream([
      'data: {"text":"I\'ll update that day."}\n\n',
      'data: {"text":"<plan:update date=\\"2025-05-12\\" objective_kind=\\"time\\" objective_value=\\"30\\" objective_unit=\\"min\\" />"}\n\n',
      'data: {"done":true}\n\n',
    ]);

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: activePlan }) })   // mount plan
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [] }) })        // mount messages
      .mockResolvedValueOnce({ ok: true, body: sseBody })                               // POST /api/chat stream
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: activePlan }) })   // fetchPlan after done
      .mockResolvedValueOnce({ ok: true })                                              // PATCH /api/plan/days/...
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: patchedPlan }) }); // fetchPlan after patches

    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const listener = vi.fn();
    window.addEventListener('plan-updated', listener);

    await act(async () => {
      await result.current.sendMessage('Update May 12th to 30 min');
    });

    expect(listener).toHaveBeenCalled();
    window.removeEventListener('plan-updated', listener);
  });

  it('strips <plan:update> tags from streaming message display', async () => {
    const sseBody = makeSseStream([
      'data: {"text":"Updating now. <plan:update date=\\"2025-05-12\\" objective_kind=\\"time\\" objective_value=\\"30\\" objective_unit=\\"min\\" /> Done!"}\n\n',
      'data: {"done":true}\n\n',
    ]);

    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: activePlan }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ messages: [] }) })
      .mockResolvedValueOnce({ ok: true, body: sseBody })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: activePlan }) })  // fetchPlan after done
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: activePlan }) }); // fetchPlan after patches

    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.sendMessage('Update May 12th');
    });

    const assistantMsg = result.current.messages.find(m => m.role === 'assistant');
    expect(assistantMsg?.content).not.toContain('<plan:update');
    expect(assistantMsg?.content).toContain('Updating now.');
  });
});

describe('useChat — plan-archived event', () => {
  it('plan-archived event resets plan and messages', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      window.dispatchEvent(new Event('plan-archived'));
    });

    expect(result.current.plan).toBeNull();
    expect(result.current.messages).toHaveLength(0);
    expect(result.current.isBusy).toBe(false);
  });
});
