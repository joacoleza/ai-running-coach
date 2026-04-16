import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Runs } from '../pages/Runs';

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

vi.mock('../hooks/useRuns', () => ({
  fetchRuns: vi.fn(),
}));

// Stub complex child components that need their own dependencies
vi.mock('../components/runs/RunDetailModal', () => ({
  RunDetailModal: ({
    run,
    onClose,
    onUpdated,
    onDeleted,
  }: {
    run: { _id: string; date: string };
    onClose: () => void;
    onUpdated: (r: { _id: string; date: string }) => void;
    onDeleted: (id: string) => void;
  }) => (
    <div data-testid="run-detail-modal">
      <span>Detail: {run.date}</span>
      <button onClick={onClose}>Close detail</button>
      <button onClick={() => onUpdated({ ...run, date: '2026-05-01' })}>Trigger update</button>
      <button onClick={() => onDeleted(run._id)}>Trigger delete</button>
    </div>
  ),
}));

vi.mock('../components/runs/RunEntryForm', () => ({
  RunEntryForm: ({
    onSave,
    onCancel,
  }: {
    onSave: () => void;
    onCancel: () => void;
  }) => (
    <div data-testid="run-entry-form">
      <button onClick={() => onSave()}>Save run</button>
      <button onClick={onCancel}>Cancel</button>
    </div>
  ),
}));

import { fetchRuns } from '../hooks/useRuns';

const mockFetchRuns = vi.mocked(fetchRuns);

const baseRun = {
  _id: 'run-1',
  date: '2026-04-01',
  distance: 5,
  duration: '25:00',
  pace: 5.0,
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
};

// Mock IntersectionObserver — not available in jsdom
const observerMock = {
  observe: vi.fn(),
  disconnect: vi.fn(),
  unobserve: vi.fn(),
};
vi.stubGlobal('IntersectionObserver', vi.fn(() => observerMock));

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchRuns.mockResolvedValue({ runs: [baseRun], total: 1, totalAll: 1 });
});

describe('Runs page', () => {
  it('renders page heading', async () => {
    await act(async () => {
      render(<Runs />);
    });
    expect(screen.getByRole('heading', { name: /runs/i })).toBeInTheDocument();
  });

  it('shows loading state initially', () => {
    mockFetchRuns.mockReturnValue(new Promise(() => {}));
    render(<Runs />);
    expect(screen.getByText(/loading runs/i)).toBeInTheDocument();
  });

  it('renders run rows after loading', async () => {
    await act(async () => {
      render(<Runs />);
    });
    expect(screen.getByText(/wednesday 01\/04\/2026/i)).toBeInTheDocument();
    expect(screen.getByText(/5km/)).toBeInTheDocument();
  });

  it('shows empty state when no runs', async () => {
    mockFetchRuns.mockResolvedValue({ runs: [], total: 0, totalAll: 0 });
    await act(async () => {
      render(<Runs />);
    });
    expect(screen.getByText(/no runs yet/i)).toBeInTheDocument();
  });

  it('shows error when fetch fails', async () => {
    mockFetchRuns.mockRejectedValue(new Error('Network error'));
    await act(async () => {
      render(<Runs />);
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('shows run count when runs exist', async () => {
    await act(async () => {
      render(<Runs />);
    });
    expect(screen.getByText(/showing 1 of 1 run/i)).toBeInTheDocument();
  });

  it('shows week/day badge for linked runs', async () => {
    const linkedRun = { ...baseRun, weekNumber: 3, dayLabel: 'C' };
    mockFetchRuns.mockResolvedValue({ runs: [linkedRun], total: 1, totalAll: 1 });
    await act(async () => {
      render(<Runs />);
    });
    expect(screen.getByText(/week 3/i)).toBeInTheDocument();
    expect(screen.getByText(/day C/i)).toBeInTheDocument();
  });

  it('opens Log a run modal when button clicked', async () => {
    await act(async () => {
      render(<Runs />);
    });
    fireEvent.click(screen.getByRole('button', { name: /log a run/i }));
    expect(screen.getByTestId('run-entry-form')).toBeInTheDocument();
  });

  it('closes Log a run modal on cancel', async () => {
    await act(async () => {
      render(<Runs />);
    });
    fireEvent.click(screen.getByRole('button', { name: /log a run/i }));
    expect(screen.getByTestId('run-entry-form')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^cancel$/i }));
    expect(screen.queryByTestId('run-entry-form')).not.toBeInTheDocument();
  });

  it('closes Log a run modal via X button in header', async () => {
    await act(async () => {
      render(<Runs />);
    });
    fireEvent.click(screen.getByRole('button', { name: /log a run/i }));
    expect(screen.getByTestId('run-entry-form')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /close/i }));
    expect(screen.queryByTestId('run-entry-form')).not.toBeInTheDocument();
  });

  it('closes Log a run modal and refreshes after save', async () => {
    await act(async () => {
      render(<Runs />);
    });
    fireEvent.click(screen.getByRole('button', { name: /log a run/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save run/i }));
    });
    expect(screen.queryByTestId('run-entry-form')).not.toBeInTheDocument();
    // fetchRuns called again (initial + after save)
    expect(mockFetchRuns).toHaveBeenCalledTimes(2);
  });

  it('closes modal when backdrop is clicked', async () => {
    await act(async () => {
      render(<Runs />);
    });
    fireEvent.click(screen.getByRole('button', { name: /log a run/i }));
    expect(screen.getByTestId('run-entry-form')).toBeInTheDocument();
    const backdrop = document.querySelector('.fixed.inset-0.bg-black\\/50') as HTMLElement;
    fireEvent.click(backdrop);
    expect(screen.queryByTestId('run-entry-form')).not.toBeInTheDocument();
  });

  it('opens run detail modal when run row is clicked', async () => {
    await act(async () => {
      render(<Runs />);
    });
    fireEvent.click(screen.getByRole('button', { name: /wednesday/i }));
    expect(screen.getByTestId('run-detail-modal')).toBeInTheDocument();
    expect(screen.getByText('Detail: 2026-04-01')).toBeInTheDocument();
  });

  it('closes run detail modal on close', async () => {
    await act(async () => {
      render(<Runs />);
    });
    fireEvent.click(screen.getByRole('button', { name: /wednesday/i }));
    fireEvent.click(screen.getByRole('button', { name: /close detail/i }));
    expect(screen.queryByTestId('run-detail-modal')).not.toBeInTheDocument();
  });

  it('updates run in list when onUpdated fires', async () => {
    await act(async () => {
      render(<Runs />);
    });
    fireEvent.click(screen.getByRole('button', { name: /wednesday/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /trigger update/i }));
    });
    // Detail modal still open (selectedRun updated), no crash
    expect(screen.getByTestId('run-detail-modal')).toBeInTheDocument();
  });

  it('removes run from list when onDeleted fires', async () => {
    await act(async () => {
      render(<Runs />);
    });
    fireEvent.click(screen.getByRole('button', { name: /wednesday/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /trigger delete/i }));
    });
    // Modal closed and run gone
    expect(screen.queryByTestId('run-detail-modal')).not.toBeInTheDocument();
    expect(screen.queryByText(/wednesday 01\/04\/2026/i)).not.toBeInTheDocument();
  });

  it('toggles filter panel on Filter button click', async () => {
    await act(async () => {
      render(<Runs />);
    });
    expect(document.querySelector('input[type="date"]')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(document.querySelector('input[type="date"]')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Filter' }));
    expect(document.querySelector('input[type="date"]')).not.toBeInTheDocument();
  });

  it('clears filters when Clear filters is clicked', async () => {
    await act(async () => {
      render(<Runs />);
    });
    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    const fromInput = document.querySelectorAll('input[type="date"]')[0] as HTMLInputElement;
    fireEvent.change(fromInput, { target: { value: '2026-01-01' } });
    expect(fromInput.value).toBe('2026-01-01');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /clear filters/i }));
    });
    await waitFor(() => {
      expect(fromInput.value).toBe('');
    });
  });

  it('refetches with filter params when filter values change', async () => {
    await act(async () => {
      render(<Runs />);
    });
    fireEvent.click(screen.getByRole('button', { name: /filter/i }));
    const fromInput = document.querySelectorAll('input[type="date"]')[0] as HTMLInputElement;
    await act(async () => {
      fireEvent.change(fromInput, { target: { value: '2026-01-01' } });
    });
    await waitFor(() => {
      expect(mockFetchRuns).toHaveBeenCalledWith(expect.objectContaining({ dateFrom: '2026-01-01' }));
    });
  });
});
