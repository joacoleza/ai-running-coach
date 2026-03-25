import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ArchivePlan } from '../pages/ArchivePlan';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

vi.mock('react-markdown', () => ({
  default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
}));

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
          startDate: '2026-04-07',
          days: [
            { date: '2026-04-07', type: 'run' as const, guidelines: 'Easy run', completed: false, skipped: false },
          ],
        },
      ],
    },
  ],
};

describe('ArchivePlan', () => {
  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderWithId('plan1');
    expect(screen.getByText('Loading plan...')).toBeInTheDocument();
  });

  it('renders plan markdown after load', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ plan: mockPlan }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByTestId('markdown')).toBeInTheDocument());
    expect(screen.getByRole('link', { name: /back to archive/i })).toHaveAttribute('href', '/archive');
  });

  it('shows error when fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByText('Failed to fetch plan')).toBeInTheDocument());
  });

  it('shows not found when plan is null', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ plan: null }) });
    renderWithId('plan1');
    await waitFor(() => expect(screen.getByText('Plan not found.')).toBeInTheDocument());
  });
});
