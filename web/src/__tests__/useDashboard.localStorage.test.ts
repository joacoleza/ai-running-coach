import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useDashboard } from '../hooks/useDashboard';

// Mock the fetch and usePlan for this test
vi.mock('../hooks/useRuns', () => ({
  fetchRuns: vi.fn(() => Promise.resolve({ runs: [] })),
}));

vi.mock('../hooks/usePlan', () => ({
  usePlan: vi.fn(() => ({
    plan: null,
    linkedRuns: new Map(),
    isLoading: false,
  })),
}));

describe('useDashboard localStorage persistence', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('initializes activeDiscipline from localStorage if set', () => {
    localStorage.setItem('dashboard_discipline_filter', 'gym');

    const { result } = renderHook(() => useDashboard());

    expect(result.current.activeDiscipline).toBe('gym');
  });

  it('defaults to "all" when localStorage key is not set', () => {
    const { result } = renderHook(() => useDashboard());

    expect(result.current.activeDiscipline).toBe('all');
  });

  it('setActiveDiscipline writes to localStorage', () => {
    const { result } = renderHook(() => useDashboard());

    act(() => {
      result.current.setActiveDiscipline('cycle');
    });

    expect(localStorage.getItem('dashboard_discipline_filter')).toBe('cycle');
  });

  it('setActiveDiscipline updates state immediately', () => {
    const { result } = renderHook(() => useDashboard());

    act(() => {
      result.current.setActiveDiscipline('gym');
    });

    expect(result.current.activeDiscipline).toBe('gym');
  });

  it('setActiveDiscipline persists across hook instances', () => {
    const { result: result1 } = renderHook(() => useDashboard());

    act(() => {
      result1.current.setActiveDiscipline('run');
    });

    // Create a new hook instance
    const { result: result2 } = renderHook(() => useDashboard());

    expect(result2.current.activeDiscipline).toBe('run');
  });

  it('handles "gym" discipline persistence', () => {
    localStorage.setItem('dashboard_discipline_filter', 'gym');
    const { result } = renderHook(() => useDashboard());

    expect(result.current.activeDiscipline).toBe('gym');
  });

  it('handles "cycle" discipline persistence', () => {
    localStorage.setItem('dashboard_discipline_filter', 'cycle');
    const { result } = renderHook(() => useDashboard());

    expect(result.current.activeDiscipline).toBe('cycle');
  });

  it('handles "run" discipline persistence', () => {
    localStorage.setItem('dashboard_discipline_filter', 'run');
    const { result } = renderHook(() => useDashboard());

    expect(result.current.activeDiscipline).toBe('run');
  });

  it('overwrites stored discipline when setActiveDiscipline is called', () => {
    localStorage.setItem('dashboard_discipline_filter', 'gym');
    const { result } = renderHook(() => useDashboard());

    expect(result.current.activeDiscipline).toBe('gym');

    act(() => {
      result.current.setActiveDiscipline('cycle');
    });

    expect(localStorage.getItem('dashboard_discipline_filter')).toBe('cycle');
    expect(result.current.activeDiscipline).toBe('cycle');
  });

  it('stores activeDiscipline under the correct localStorage key', () => {
    const { result } = renderHook(() => useDashboard());

    act(() => {
      result.current.setActiveDiscipline('gym');
    });

    // Verify the exact key name
    expect(localStorage.getItem('dashboard_discipline_filter')).not.toBeNull();
    expect(localStorage.getItem('dashboard_discipline_filter')).toBe('gym');
  });
});
