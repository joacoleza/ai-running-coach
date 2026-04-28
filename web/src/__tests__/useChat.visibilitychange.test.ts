import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { MemoryRouter } from 'react-router-dom';
import { useChat } from '../hooks/useChat';

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({
    token: 'test-token',
    logout: vi.fn(),
    email: 'test@example.com',
    isAdmin: false,
    tempPassword: false,
    login: vi.fn(),
  }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const wrapper = ({ children }: { children: React.ReactNode }) =>
  React.createElement(MemoryRouter, null, children);

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.setItem('access_token', 'test-token');
  mockFetch.mockResolvedValue({ ok: true, json: async () => ({ plan: null }) });
});

describe('useChat — visibilitychange re-fetch', () => {
  it('re-fetches plan when page becomes visible and plan is null', async () => {
    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const callsBefore = mockFetch.mock.calls.length;

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await waitFor(() => expect(mockFetch.mock.calls.length).toBeGreaterThan(callsBefore));
  });

  it('skips re-fetch when plan is already loaded', async () => {
    const activePlan = {
      _id: 'p1', status: 'active', phases: [],
      onboardingMode: 'conversational', onboardingStep: 6, goal: {},
    };
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('/api/messages')) {
        return Promise.resolve({ ok: true, json: async () => ({ messages: [] }) });
      }
      return Promise.resolve({ ok: true, json: async () => ({ plan: activePlan }) });
    });

    const { result } = renderHook(() => useChat(), { wrapper });
    await waitFor(() => expect(result.current.plan).not.toBeNull());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const callsBefore = mockFetch.mock.calls.length;

    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    await new Promise(r => setTimeout(r, 50));
    expect(mockFetch.mock.calls.length).toBe(callsBefore);
  });
});
