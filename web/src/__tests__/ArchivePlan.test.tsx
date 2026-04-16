import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ArchivePlan } from '../pages/ArchivePlan';

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

// CoachPanel mock — readonly mode renders a stub with recognizable elements
vi.mock('../components/coach/CoachPanel', () => ({
  CoachPanel: ({ readonly, isOpen }: { readonly?: boolean; isOpen: boolean }) => (
    <div data-testid="coach-panel" data-readonly={String(readonly)} data-open={String(isOpen)} />
  ),
}));

vi.mock('../components/plan/PlanView', () => ({
  PlanView: ({ plan, readonly }: { plan: { phases: unknown[] }; readonly?: boolean }) => (
    <div data-testid="plan-view" data-readonly={String(readonly)} data-phases={plan.phases.length} />
  ),
}));

vi.mock('../components/runs/RunDetailModal', () => ({
  RunDetailModal: ({ run, onClose }: { run: { _id: string }; onClose: () => void }) => (
    <div data-testid="run-detail-modal" data-run-id={run._id}>
      <button onClick={onClose}>Close</button>
    </div>
  ),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.setItem('app_password', 'test-pw');
});

function renderWithId(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/archive/${id}`]}>
      <Routes>
        <Route path="/archive/:id" element={<ArchivePlan />} />
      </Routes>
    </MemoryRouter>,
  );
}

const mockPlan = {
  _id: 'plan1',
  status: 'archived' as const,
  onboardingMode: 'conversational' as const,
  onboardingStep: 0,
  goal: { eventType: 'marathon', targetDate: '2026-10-01', weeklyMileage: 50, availableDays: 5, units: 'km' },
  objective: 'marathon' as const,
  targetDate: '2026-10-01',
  phases: [
    {
      name: 'Base',
      description: 'Build aerobic base',
      weeks: [
        {
          weekNumber: 1,
          days: [
            { label: 'A', type: 'run' as const, guidelines: 'Easy run', completed: false, skipped: false },
          ],
        },
      ],
    },
  ],
};

function mockFetchWithMessages(planResponse: { ok: boolean; json?: () => Promise<unknown> }) {
  mockFetch.mockImplementation((url: string) => {
    if (typeof url === 'string' && url.includes('/api/messages')) {
      return Promise.resolve({ ok: true, json: async () => ({ messages: [] }) });
    }
    if (typeof url === 'string' && url.includes('/api/runs/')) {
      return Promise.resolve({ ok: true, json: async () => ({ _id: 'run1', date: '2026-04-01', distance: 10, duration: '50:00', pace: 5.0 }) });
    }
    if (planResponse.ok && planResponse.json) {
      return Promise.resolve({ ok: true, json: planResponse.json });
    }
    return Promise.resolve({ ok: false });
  });
}

describe('ArchivePlan', () => {
  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithId('plan1');
    expect(screen.getByText('Loading plan...')).toBeInTheDocument();
  });

  it('renders PlanView after load', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: mockPlan, linkedRuns: {} }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('plan-view')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /back to archive/i })).toHaveAttribute('href', '/archive');
  });

  it('renders PlanView in readonly mode', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: mockPlan, linkedRuns: {} }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('plan-view')).toBeInTheDocument());
    expect(screen.getByTestId('plan-view').getAttribute('data-readonly')).toBe('true');
  });

  it('shows error when fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByText('Failed to fetch plan')).toBeInTheDocument());
  });

  it('shows not found when plan is null', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: null, linkedRuns: {} }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByText('Plan not found.')).toBeInTheDocument());
  });

  it('fetches chat history on mount after plan loads', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: mockPlan, linkedRuns: {} }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('plan-view')).toBeInTheDocument());
    // Verify fetch was called with messages endpoint
    const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((url: string) => url.includes('api/messages?planId='))).toBe(true);
  });

  it('renders CoachPanel in readonly mode', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: mockPlan, linkedRuns: {} }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('coach-panel')).toBeInTheDocument());
    expect(screen.getByTestId('coach-panel').getAttribute('data-readonly')).toBe('true');
  });

  it('renders FAB with aria-label View plan history', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: mockPlan, linkedRuns: {} }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('plan-view')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /view plan history/i })).toBeInTheDocument();
  });

  it('FAB has bg-gray-500 class', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: mockPlan, linkedRuns: {} }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('plan-view')).toBeInTheDocument());
    const fab = screen.getByRole('button', { name: /view plan history/i });
    expect(fab.className).toContain('bg-gray-500');
  });

  it('open-run-detail event fetches run and shows RunDetailModal', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: mockPlan, linkedRuns: {} }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('plan-view')).toBeInTheDocument());
    window.dispatchEvent(new CustomEvent('open-run-detail', { detail: { runId: 'run1' } }));
    await waitFor(() => expect(screen.getByTestId('run-detail-modal')).toBeInTheDocument());
    expect(screen.getByTestId('run-detail-modal').getAttribute('data-run-id')).toBe('run1');
  });
});
