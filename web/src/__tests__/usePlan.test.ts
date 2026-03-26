import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { usePlan } from '../hooks/usePlan';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockPlan = {
  _id: 'p1',
  status: 'active',
  onboardingMode: 'conversational',
  onboardingStep: 0,
  goal: { eventType: 'marathon', targetDate: '2026-10-01', weeklyMileage: 50, availableDays: 5, units: 'km' },
  phases: [],
};

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.setItem('app_password', 'test-pw');
});

describe('usePlan', () => {
  it('fetches plan on mount and sets plan state', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ plan: mockPlan }) });
    const { result } = renderHook(() => usePlan());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.plan).toEqual(mockPlan);
    expect(result.current.error).toBeNull();
  });

  it('sets plan to null when API returns no plan', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) });
    const { result } = renderHook(() => usePlan());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.plan).toBeNull();
  });

  it('sets error when fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    const { result } = renderHook(() => usePlan());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Failed to fetch plan');
  });

  it('sets error on network exception', async () => {
    mockFetch.mockRejectedValue(new Error('Network down'));
    const { result } = renderHook(() => usePlan());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBe('Network down');
  });

  it('updateDay PATCHes and refreshes plan', async () => {
    const updatedPlan = { ...mockPlan, _id: 'p1-updated' };
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: mockPlan }) }) // initial fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })                // PATCH
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: updatedPlan }) }); // refresh

    const { result } = renderHook(() => usePlan());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.updateDay('2026-04-07', { completed: 'true' });
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/plan/days/2026-04-07', expect.objectContaining({ method: 'PATCH' }));
    expect(result.current.plan).toEqual(updatedPlan);
  });

  it('updateDay throws when PATCH fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: mockPlan }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Update failed' }) });

    const { result } = renderHook(() => usePlan());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(act(async () => {
      await result.current.updateDay('2026-04-07', { completed: 'true' });
    })).rejects.toThrow('Update failed');
  });

  it('archivePlan POSTs to archive, clears plan, and dispatches plan-archived event', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: mockPlan }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) });

    const listener = vi.fn();
    window.addEventListener('plan-archived', listener);

    const { result } = renderHook(() => usePlan());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.archivePlan();
    });

    expect(mockFetch).toHaveBeenCalledWith('/api/plan/archive', expect.objectContaining({ method: 'POST' }));
    expect(result.current.plan).toBeNull();
    expect(listener).toHaveBeenCalled();
    window.removeEventListener('plan-archived', listener);
  });

  it('archivePlan throws when POST fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: mockPlan }) })
      .mockResolvedValueOnce({ ok: false });

    const { result } = renderHook(() => usePlan());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(act(async () => {
      await result.current.archivePlan();
    })).rejects.toThrow('Failed to archive plan');
  });

  it('deleteDay DELETEs and refreshes plan', async () => {
    const updatedPlan = { ...mockPlan, _id: 'p1-after-delete' };
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: mockPlan }) })    // initial fetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: updatedPlan }) }) // DELETE
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: updatedPlan }) }); // refresh

    const { result } = renderHook(() => usePlan());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await act(async () => {
      await result.current.deleteDay('2026-04-07');
    });

    expect(mockFetch).toHaveBeenCalledWith(
      '/api/plan/days/2026-04-07',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(result.current.plan?._id).toBe('p1-after-delete');
  });

  it('deleteDay throws when DELETE fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: mockPlan }) })
      .mockResolvedValueOnce({ ok: false, json: async () => ({ error: 'Delete failed' }) });

    const { result } = renderHook(() => usePlan());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    await expect(act(async () => {
      await result.current.deleteDay('2026-04-07');
    })).rejects.toThrow('Delete failed');
  });

  it('refreshes plan when plan-updated event fires', async () => {
    const updatedPlan = { ...mockPlan, _id: 'after-event' };
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: mockPlan }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ plan: updatedPlan }) });

    const { result } = renderHook(() => usePlan());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.plan?._id).toBe('p1');

    await act(async () => {
      window.dispatchEvent(new Event('plan-updated'));
    });

    await waitFor(() => expect(result.current.plan?._id).toBe('after-event'));
  });
});
