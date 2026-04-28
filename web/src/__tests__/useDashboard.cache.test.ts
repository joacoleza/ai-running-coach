import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useDashboard, clearDashboardCache } from '../hooks/useDashboard';

vi.mock('../hooks/usePlan', () => ({
  usePlan: vi.fn(() => ({ plan: null, linkedRuns: new Map(), isLoading: false })),
}));

const mockFetchRuns = vi.fn();
vi.mock('../hooks/useRuns', () => ({
  fetchRuns: (...args: unknown[]) => mockFetchRuns(...args),
}));

beforeEach(() => {
  clearDashboardCache();
  mockFetchRuns.mockClear();
  mockFetchRuns.mockResolvedValue({ runs: [] });
});

describe('clearDashboardCache', () => {
  it('is callable without throwing', () => {
    expect(() => clearDashboardCache()).not.toThrow();
  });
});

describe('useDashboard — runs cache', () => {
  it('starts with isLoading=true on cache miss (fresh mount)', async () => {
    const { result } = renderHook(() => useDashboard());
    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isLoading).toBe(false));
  });

  it('calls fetchRuns once on first mount', async () => {
    const { unmount } = renderHook(() => useDashboard());
    await waitFor(() => expect(mockFetchRuns).toHaveBeenCalledTimes(1));
    unmount();
  });

  it('starts with isLoading=false on cache hit (re-mount within TTL)', async () => {
    const { unmount: u1 } = renderHook(() => useDashboard());
    await waitFor(() => expect(mockFetchRuns).toHaveBeenCalledTimes(1));
    u1();

    // Same filter (current-plan) + same planId (undefined) → cache hit
    const { result } = renderHook(() => useDashboard());
    expect(result.current.isLoading).toBe(false);
  });

  it('clearDashboardCache causes isLoading=true on next mount', async () => {
    const { unmount: u1 } = renderHook(() => useDashboard());
    await waitFor(() => expect(mockFetchRuns).toHaveBeenCalledTimes(1));
    u1();

    clearDashboardCache();

    const { result } = renderHook(() => useDashboard());
    expect(result.current.isLoading).toBe(true);
  });

  it('stale-while-revalidate: still fetches in background even on cache hit', async () => {
    const { unmount: u1 } = renderHook(() => useDashboard());
    await waitFor(() => expect(mockFetchRuns).toHaveBeenCalledTimes(1));
    u1();

    mockFetchRuns.mockClear();
    const { unmount: u2 } = renderHook(() => useDashboard());
    // Background fetch still happens
    await waitFor(() => expect(mockFetchRuns).toHaveBeenCalledTimes(1));
    u2();
  });
});
