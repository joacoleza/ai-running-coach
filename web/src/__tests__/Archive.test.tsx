import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { Archive } from '../pages/Archive';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  localStorage.setItem('app_password', 'test-pw');
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

  it('renders plan links for archived plans', async () => {
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
