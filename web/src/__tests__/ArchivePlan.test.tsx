import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ArchivePlan } from '../pages/ArchivePlan';

// CoachPanel mock — readonly mode renders a stub with recognizable elements
vi.mock('../components/coach/CoachPanel', () => ({
  CoachPanel: ({ readonly, isOpen }: { readonly?: boolean; isOpen: boolean }) => (
    <div data-testid="coach-panel" data-readonly={String(readonly)} data-open={String(isOpen)} />
  ),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('react-markdown', () => ({
  default: ({ children, remarkPlugins }: { children: string; remarkPlugins?: unknown[] }) => (
    <div data-testid="markdown" data-plugins={remarkPlugins?.length ?? 0}>{children}</div>
  ),
}));

vi.mock('remark-gfm', () => ({ default: () => {} }));

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

  it('renders plan markdown after load', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: mockPlan }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('markdown')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /back to archive/i })).toHaveAttribute('href', '/archive');
  });

  it('passes remark-gfm plugin to ReactMarkdown (enables strikethrough for completed days)', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: mockPlan }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('markdown')).toBeInTheDocument());
    const md = screen.getByTestId('markdown');
    // data-plugins counts the remarkPlugins array length — should be 1 (remark-gfm)
    expect(md.getAttribute('data-plugins')).toBe('1');
  });

  it('shows error when fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByText('Failed to fetch plan')).toBeInTheDocument());
  });

  it('shows not found when plan is null', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: null }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByText('Plan not found.')).toBeInTheDocument());
  });

  it('fetches chat history on mount after plan loads', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: mockPlan }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('markdown')).toBeInTheDocument());
    // Verify fetch was called with messages endpoint
    const calls = mockFetch.mock.calls.map((c: unknown[]) => c[0] as string);
    expect(calls.some((url: string) => url.includes('api/messages?planId='))).toBe(true);
  });

  it('renders CoachPanel in readonly mode', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: mockPlan }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('coach-panel')).toBeInTheDocument());
    expect(screen.getByTestId('coach-panel').getAttribute('data-readonly')).toBe('true');
  });

  it('renders FAB with aria-label View plan history', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: mockPlan }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('markdown')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /view plan history/i })).toBeInTheDocument();
  });

  it('FAB has bg-gray-500 class', async () => {
    mockFetchWithMessages({ ok: true, json: async () => ({ plan: mockPlan }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('markdown')).toBeInTheDocument());
    const fab = screen.getByRole('button', { name: /view plan history/i });
    expect(fab.className).toContain('bg-gray-500');
  });
});
