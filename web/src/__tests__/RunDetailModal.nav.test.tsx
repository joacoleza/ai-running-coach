import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RunDetailModal } from '../components/runs/RunDetailModal';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});
import type { Run } from '../hooks/useRuns';

vi.mock('../contexts/ChatContext', () => ({
  useChatContext: vi.fn(() => ({
    sendMessage: vi.fn().mockResolvedValue('Great run feedback'),
    messages: [],
    isStreaming: false,
    isBusy: false,
    isLoading: false,
    isGeneratingPlan: false,
    error: null,
    plan: null,
    startPlan: vi.fn(),
    startOver: vi.fn(),
    clearError: vi.fn(),
  })),
}));

vi.mock('../hooks/useRuns', () => ({
  updateRun: vi.fn(),
  deleteRun: vi.fn(),
  unlinkRun: vi.fn(),
}));

import { unlinkRun } from '../hooks/useRuns';

const mockRun: Run = {
  _id: 'run-001',
  date: '2026-04-01',
  distance: 5,
  duration: '25:00',
  pace: 5.0,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
};

const mockLinkedRun: Run = {
  ...mockRun,
  planId: 'plan-123',
  weekNumber: 1,
  dayLabel: 'B',
};

const onClose = vi.fn();
const onUpdated = vi.fn();
const onDeleted = vi.fn();

beforeEach(() => {
  onClose.mockClear();
  onUpdated.mockClear();
  onDeleted.mockClear();
  mockNavigate.mockClear();
  vi.clearAllMocks();
});

describe('RunDetailModal — UX-NAV-02: Week/Day badge navigates and dispatches event', () => {
  it('renders Week/Day badge as button when run is linked to plan', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockLinkedRun} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    const badge = screen.getByText(/Week 1 · Day B/i);
    expect(badge.tagName).toBe('BUTTON');
  });

  it('badge is green when activePlanId matches run planId (active plan)', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockLinkedRun} activePlanId="plan-123" onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    const badge = screen.getByText(/Week 1 · Day B/i);
    expect(badge.className).toContain('bg-green-100');
    expect(badge.className).toContain('text-green-700');
  });

  it('badge is gray when activePlanId does not match run planId (archived plan)', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockLinkedRun} activePlanId="different-plan" onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    const badge = screen.getByText(/Week 1 · Day B/i);
    expect(badge.className).toContain('bg-gray-100');
    expect(badge.className).toContain('text-gray-600');
  });

  it('does not render badge when run is not linked to plan', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    const badge = screen.queryByText(/Week.*Day/i);
    expect(badge).not.toBeInTheDocument();
  });

  it('clicking badge calls onClose', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockLinkedRun} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    const badge = screen.getByText(/Week 1 · Day B/i);
    fireEvent.click(badge);

    expect(onClose).toHaveBeenCalled();
  });

  it('clicking badge on active plan dispatches navigate-to-day event after delay', () => {
    vi.useFakeTimers();
    const eventSpy = vi.fn();
    window.addEventListener('navigate-to-day', eventSpy);

    render(
      <MemoryRouter>
        <RunDetailModal run={mockLinkedRun} activePlanId="plan-123" onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    const badge = screen.getByText(/Week 1 · Day B/i);
    fireEvent.click(badge);

    // Before timeout, event should not be dispatched
    expect(eventSpy).not.toHaveBeenCalled();

    // Advance timers past the 150ms setTimeout
    vi.advanceTimersByTime(150);

    expect(eventSpy).toHaveBeenCalled();
    const event = eventSpy.mock.calls[0][0] as CustomEvent;
    expect(event.detail.weekNumber).toBe(1);
    expect(event.detail.dayLabel).toBe('B');

    window.removeEventListener('navigate-to-day', eventSpy);
    vi.useRealTimers();
  });

  it('clicking badge on archived plan navigates to /archive/:planId and does NOT dispatch navigate-to-day', () => {
    vi.useFakeTimers();
    const eventSpy = vi.fn();
    window.addEventListener('navigate-to-day', eventSpy);

    render(
      <MemoryRouter>
        <RunDetailModal run={mockLinkedRun} activePlanId="different-plan" onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByText(/Week 1 · Day B/i));
    vi.advanceTimersByTime(200);

    expect(mockNavigate).toHaveBeenCalledWith('/archive/plan-123');
    expect(eventSpy).not.toHaveBeenCalled();

    window.removeEventListener('navigate-to-day', eventSpy);
    vi.useRealTimers();
  });
});

describe('RunDetailModal — UX-MODAL-03: Unlink from plan button', () => {
  it('renders "Unlink from plan" button for linked runs', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockLinkedRun} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    const unlinkBtn = screen.getByText(/Unlink from plan/i);
    expect(unlinkBtn).toBeInTheDocument();
  });

  it('does not render "Unlink from plan" button for unlinked runs', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    const unlinkBtn = screen.queryByText(/Unlink from plan/i);
    expect(unlinkBtn).not.toBeInTheDocument();
  });

  it('clicking unlink button shows browser confirm dialog', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <MemoryRouter>
        <RunDetailModal run={mockLinkedRun} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    const unlinkBtn = screen.getByText(/Unlink from plan/i);
    fireEvent.click(unlinkBtn);

    expect(window.confirm).toHaveBeenCalledWith(
      'Unlink this run from the training plan day? The day will be marked incomplete.'
    );
    vi.restoreAllMocks();
  });

  it('confirming unlink calls unlinkRun API', async () => {
    vi.mocked(unlinkRun).mockResolvedValue({ ...mockLinkedRun, planId: undefined });
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter>
        <RunDetailModal run={mockLinkedRun} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    const unlinkBtn = screen.getByText(/Unlink from plan/i);
    fireEvent.click(unlinkBtn);

    await waitFor(() => expect(unlinkRun).toHaveBeenCalledWith('run-001'), { timeout: 2000 });
    vi.restoreAllMocks();
  });

  it('calling onUpdated with unlinked run after successful unlink', async () => {
    const unlinkedRun = { ...mockLinkedRun, planId: undefined };
    vi.mocked(unlinkRun).mockResolvedValue(unlinkedRun);
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <MemoryRouter>
        <RunDetailModal run={mockLinkedRun} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    const unlinkBtn = screen.getByText(/Unlink from plan/i);
    fireEvent.click(unlinkBtn);

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(unlinkedRun), { timeout: 2000 });
    vi.restoreAllMocks();
  });

  it('cancelling unlink does not call unlinkRun', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <MemoryRouter>
        <RunDetailModal run={mockLinkedRun} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    const unlinkBtn = screen.getByText(/Unlink from plan/i);
    fireEvent.click(unlinkBtn);

    expect(unlinkRun).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});

describe('RunDetailModal — UAT-14: 2-column field layout', () => {
  it('renders Date, Distance, Duration, and Avg HR inside a shared grid-cols-2 container', () => {
    const { container } = render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    const grid = container.querySelector('.grid.grid-cols-2');
    expect(grid).not.toBeNull();

    const labelTexts = Array.from(grid!.querySelectorAll('label')).map(l => l.textContent?.trim() ?? '');
    expect(labelTexts.some(t => t.startsWith('Date'))).toBe(true);
    expect(labelTexts.some(t => t.startsWith('Distance'))).toBe(true);
    expect(labelTexts.some(t => t.startsWith('Duration'))).toBe(true);
    expect(labelTexts.some(t => t.startsWith('Avg HR'))).toBe(true);
  });
});

describe('RunDetailModal — UX-MODAL-02: Notes textarea rows=4', () => {
  it('renders notes textarea with rows=4', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={onClose} onUpdated={onUpdated} onDeleted={onDeleted} />
      </MemoryRouter>
    );

    // Find textarea by placeholder since notes are empty
    const notesTextarea = screen.getByPlaceholderText('How did it feel?') as HTMLTextAreaElement;
    expect(notesTextarea).toBeInTheDocument();
    expect(notesTextarea.rows).toBe(4);
  });
});
