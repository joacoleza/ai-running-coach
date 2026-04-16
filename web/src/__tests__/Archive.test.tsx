import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Archive } from '../pages/Archive';

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

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.setItem('access_token', 'test-token');
});

describe('Archive', () => {
  it('shows loading state initially', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><Archive /></MemoryRouter>);
    expect(screen.getByText('Loading archive...')).toBeInTheDocument();
  });

  it('shows empty state when no archived plans', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ plans: [] }) });
    render(<MemoryRouter><Archive /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('No archived plans yet.')).toBeInTheDocument());
  });

  it('renders plan links with title for archived plans', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        plans: [
          { _id: 'abc123', objective: 'marathon', createdAt: '2026-01-01', status: 'archived' },
          { _id: 'def456', goal: { eventType: '10km' }, createdAt: '2026-02-01', status: 'archived' },
        ],
      }),
    });
    render(<MemoryRouter><Archive /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('marathon')).toBeInTheDocument());
    expect(screen.getByText('10km')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /marathon/i })).toHaveAttribute('href', '/archive/abc123');
  });

  it('shows target date when available on plan.targetDate', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        plans: [
          { _id: 'a1', objective: '10km', targetDate: '2026-06-27', createdAt: '2026-01-01', status: 'archived' },
        ],
      }),
    });
    render(<MemoryRouter><Archive /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/target/i)).toBeInTheDocument());
    expect(screen.getByText(/jun/i)).toBeInTheDocument();
  });

  it('shows target date from goal.targetDate when plan.targetDate is absent', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        plans: [
          { _id: 'a2', objective: 'marathon', goal: { eventType: 'marathon', targetDate: '2026-10-01' }, createdAt: '2026-01-01', status: 'archived' },
        ],
      }),
    });
    render(<MemoryRouter><Archive /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText(/oct/i)).toBeInTheDocument());
  });

  it('shows no date label when no targetDate present', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        plans: [{ _id: 'a3', objective: 'marathon', createdAt: '2026-01-01', status: 'archived' }],
      }),
    });
    render(<MemoryRouter><Archive /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('marathon')).toBeInTheDocument());
    expect(screen.queryByText(/target/i)).not.toBeInTheDocument();
  });

  it('shows fallback name when no objective or goal', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        plans: [{ _id: 'xyz', createdAt: '2026-01-01', status: 'archived' }],
      }),
    });
    render(<MemoryRouter><Archive /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Training Plan')).toBeInTheDocument());
  });

  it('shows error when fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false });
    render(<MemoryRouter><Archive /></MemoryRouter>);
    await waitFor(() => expect(screen.getByText('Failed to fetch archived plans')).toBeInTheDocument());
  });
});
