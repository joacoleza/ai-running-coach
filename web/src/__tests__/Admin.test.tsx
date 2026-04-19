import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { Admin } from '../pages/Admin';
import { Sidebar } from '../components/layout/Sidebar';
import { MemoryRouter } from 'react-router-dom';

const mockUseAuth = vi.fn(() => ({
  token: 'test-token',
  email: 'admin@example.com',
  isAdmin: true,
  logout: vi.fn(),
  login: vi.fn(),
  tempPassword: false,
}));

vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

function makeUser(overrides = {}) {
  return {
    _id: '1',
    email: 'user@example.com',
    active: true,
    tempPassword: false,
    lastLoginAt: null as string | null,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('Admin page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      token: 'test-token',
      email: 'admin@example.com',
      isAdmin: true,
      logout: vi.fn(),
      login: vi.fn(),
      tempPassword: false,
    });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ users: [] }),
    });
  });

  it('renders loading state initially', async () => {
    // Return a promise that never resolves during this test
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );
    expect(screen.getByText('Loading users...')).toBeInTheDocument();
  });

  it('renders user table after load', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        users: [makeUser({ _id: '1', email: 'a@b.com', active: true, tempPassword: false, lastLoginAt: null })],
      }),
    });
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('a@b.com')).toBeInTheDocument();
      expect(screen.getByText('Active')).toBeInTheDocument();
    });
  });

  it('shows Pending badge for tempPassword user', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        users: [makeUser({ _id: '2', email: 'pending@example.com', tempPassword: true, active: true })],
      }),
    });
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });
  });

  it('shows Deactivated badge for inactive user', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        users: [makeUser({ _id: '3', email: 'inactive@example.com', active: false, tempPassword: false })],
      }),
    });
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );
    await waitFor(() => {
      expect(screen.getByText('Deactivated')).toBeInTheDocument();
    });
  });

  it('Create User button opens modal', async () => {
    render(
      <MemoryRouter>
        <Admin />
      </MemoryRouter>
    );
    // Wait for loading to finish
    await waitFor(() => {
      expect(screen.queryByText('Loading users...')).not.toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole('button', { name: 'Create User' }));
    expect(screen.getByRole('dialog', { name: 'Create User' })).toBeInTheDocument();
  });
});

describe('Sidebar admin link', () => {
  it('Admin link hidden for non-admin', () => {
    mockUseAuth.mockReturnValue({
      token: 'test-token',
      email: 'user@example.com',
      isAdmin: false,
      logout: vi.fn(),
      login: vi.fn(),
      tempPassword: false,
    });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.queryByText('Admin')).not.toBeInTheDocument();
  });

  it('Admin link shown for admin', () => {
    mockUseAuth.mockReturnValue({
      token: 'test-token',
      email: 'admin@example.com',
      isAdmin: true,
      logout: vi.fn(),
      login: vi.fn(),
      tempPassword: false,
    });
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );
    expect(screen.getByText('Admin')).toBeInTheDocument();
  });
});
