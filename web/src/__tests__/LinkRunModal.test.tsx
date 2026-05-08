import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LinkRunModal } from '../components/runs/LinkRunModal';

vi.mock('../hooks/useRuns', () => ({
  fetchUnlinkedRuns: vi.fn(),
  linkRun: vi.fn(),
}));

import { fetchUnlinkedRuns, linkRun } from '../hooks/useRuns';

const mockFetchUnlinkedRuns = vi.mocked(fetchUnlinkedRuns);
const mockLinkRun = vi.mocked(linkRun);

const baseRun = {
  _id: 'run-1',
  date: '2026-04-01',
  distance: 5,
  duration: '25:00',
  pace: 5.0,
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
};

const defaultProps = {
  weekNumber: 2,
  dayLabel: 'B',
  dayGuidelines: '8km easy run',
  onLinked: vi.fn(),
  onClose: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchUnlinkedRuns.mockResolvedValue([]);
  mockLinkRun.mockResolvedValue({ ...baseRun, weekNumber: 2, dayLabel: 'B' });
});

describe('LinkRunModal', () => {
  it('renders header with week/day info and guidelines', async () => {
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });
    expect(screen.getByText(/week 2 day B/i)).toBeInTheDocument();
    expect(screen.getByText(/target: 8km easy run/i)).toBeInTheDocument();
  });

  it('shows loading spinner initially', () => {
    // Don't resolve the promise yet
    mockFetchUnlinkedRuns.mockReturnValue(new Promise(() => {}));
    render(<LinkRunModal {...defaultProps} />);
    expect(screen.getByText(/loading runs/i)).toBeInTheDocument();
  });

  it('shows empty state when no unlinked runs', async () => {
    mockFetchUnlinkedRuns.mockResolvedValue([]);
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });
    expect(screen.getByText(/no unlinked run sessions available/i)).toBeInTheDocument();
  });

  it('renders runs list after loading', async () => {
    mockFetchUnlinkedRuns.mockResolvedValue([baseRun]);
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });
    expect(screen.getByText(/5km/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^link$/i })).toBeInTheDocument();
  });

  it('filters runs by search query (date match)', async () => {
    const run2 = { ...baseRun, _id: 'run-2', date: '2026-03-15', distance: 10 };
    mockFetchUnlinkedRuns.mockResolvedValue([baseRun, run2]);
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });
    const searchInput = screen.getByPlaceholderText(/search by date or distance/i);
    fireEvent.change(searchInput, { target: { value: 'wednesday' } });
    // Only the Wednesday run should be visible
    expect(screen.queryAllByRole('button', { name: /^link$/i })).toHaveLength(1);
  });

  it('filters runs by search query (distance match)', async () => {
    const run2 = { ...baseRun, _id: 'run-2', date: '2026-03-15', distance: 10 };
    mockFetchUnlinkedRuns.mockResolvedValue([baseRun, run2]);
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });
    const searchInput = screen.getByPlaceholderText(/search by date or distance/i);
    fireEvent.change(searchInput, { target: { value: '10' } });
    expect(screen.queryAllByRole('button', { name: /^link$/i })).toHaveLength(1);
  });

  it('shows no-results message when search matches nothing', async () => {
    mockFetchUnlinkedRuns.mockResolvedValue([baseRun]);
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });
    const searchInput = screen.getByPlaceholderText(/search by date or distance/i);
    fireEvent.change(searchInput, { target: { value: 'xyzzy' } });
    expect(screen.getByText(/no runs match your search/i)).toBeInTheDocument();
  });

  it('links run on Link click and calls onLinked', async () => {
    mockFetchUnlinkedRuns.mockResolvedValue([baseRun]);
    const onLinked = vi.fn();
    await act(async () => {
      render(<LinkRunModal {...defaultProps} onLinked={onLinked} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^link$/i }));
    });
    expect(mockLinkRun).toHaveBeenCalledWith('run-1', 2, 'B');
    expect(onLinked).toHaveBeenCalled();
  });

  it('dispatches plan-updated event on successful link', async () => {
    mockFetchUnlinkedRuns.mockResolvedValue([baseRun]);
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^link$/i }));
    });
    expect(dispatchSpy).toHaveBeenCalledWith(expect.objectContaining({ type: 'plan-updated' }));
  });

  it('shows error message when link fails', async () => {
    mockFetchUnlinkedRuns.mockResolvedValue([baseRun]);
    mockLinkRun.mockRejectedValue(new Error('Day already linked'));
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^link$/i }));
    });
    await waitFor(() => {
      expect(screen.getByText('Day already linked')).toBeInTheDocument();
    });
  });

  it('shows error when fetch fails', async () => {
    mockFetchUnlinkedRuns.mockRejectedValue(new Error('Network error'));
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });
    expect(screen.getByText('Network error')).toBeInTheDocument();
  });

  it('calls onClose when Cancel button is clicked', async () => {
    const onClose = vi.fn();
    await act(async () => {
      render(<LinkRunModal {...defaultProps} onClose={onClose} />);
    });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when backdrop is clicked', async () => {
    const onClose = vi.fn();
    await act(async () => {
      render(<LinkRunModal {...defaultProps} onClose={onClose} />);
    });
    // Click the backdrop (the outermost div)
    const backdrop = document.querySelector('.fixed.inset-0') as HTMLElement;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalled();
  });

  it('shows run count when search is active', async () => {
    const runs = [baseRun, { ...baseRun, _id: 'run-2', date: '2026-03-15' }];
    mockFetchUnlinkedRuns.mockResolvedValue(runs);
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });
    const searchInput = screen.getByPlaceholderText(/search by date or distance/i);
    fireEvent.change(searchInput, { target: { value: 'wednesday' } });
    // Shows "Showing X of Y runs"
    await waitFor(() => {
      expect(screen.getByText(/showing \d+ of \d+ runs/i)).toBeInTheDocument();
    });
  });

  it('displays cycling run with speed (km/h) instead of pace in list item', async () => {
    const cyclingRun = {
      ...baseRun,
      _id: 'cycle-1',
      date: '2026-04-01',
      distance: 30,
      duration: '60:00',
      pace: 0,
      discipline: 'cycle',
    };
    mockFetchUnlinkedRuns.mockResolvedValue([cyclingRun]);
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });

    // Should show: date · distance · speed
    expect(screen.getByText(/30km/)).toBeInTheDocument();
    expect(screen.getByText(/30.0 km\/h/)).toBeInTheDocument();
    // Should NOT show pace format (M:SS/km)
    expect(screen.queryByText(/\d+:\d{2}\/km/)).not.toBeInTheDocument();
  });

  it('displays gym run with date + type + duration (NOT distance and pace)', async () => {
    const gymRun = {
      ...baseRun,
      _id: 'gym-1',
      date: '2026-04-01',
      distance: 0,
      duration: '45:30',
      pace: 0,
      discipline: 'gym',
      type: 'upper body',
    };
    mockFetchUnlinkedRuns.mockResolvedValue([gymRun]);
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });

    // Should show: date · session type · duration
    expect(screen.getByText(/upper body/i)).toBeInTheDocument();
    expect(screen.getByText(/45:30/)).toBeInTheDocument();
    // Should NOT show "0km" or pace
    expect(screen.queryByText(/0km/)).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+:\d{2}\/km/)).not.toBeInTheDocument();
  });

  it('displays gym run with "Gym" as type fallback when type is missing', async () => {
    const gymRun = {
      ...baseRun,
      _id: 'gym-2',
      date: '2026-04-01',
      distance: 0,
      duration: '60:00',
      pace: 0,
      discipline: 'gym',
    };
    mockFetchUnlinkedRuns.mockResolvedValue([gymRun]);
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });

    expect(screen.getByText(/gym/i)).toBeInTheDocument();
    expect(screen.getByText(/60:00/)).toBeInTheDocument();
    expect(screen.queryByText(/0km/)).not.toBeInTheDocument();
  });

  it('gym session can be searched by duration', async () => {
    const gymRun = {
      ...baseRun,
      _id: 'gym-3',
      date: '2026-04-01',
      distance: 0,
      duration: '45:30',
      pace: 0,
      discipline: 'gym',
      type: 'lower body',
    };
    const runRun = { ...baseRun, _id: 'run-x', date: '2026-03-10', distance: 10, duration: '50:00', pace: 5 };
    mockFetchUnlinkedRuns.mockResolvedValue([gymRun, runRun]);
    await act(async () => {
      render(<LinkRunModal {...defaultProps} />);
    });

    const searchInput = screen.getByPlaceholderText(/search by date or distance/i);
    fireEvent.change(searchInput, { target: { value: '45:30' } });

    // Only the gym run matching duration should be visible
    expect(screen.queryAllByRole('button', { name: /^link$/i })).toHaveLength(1);
  });
});
