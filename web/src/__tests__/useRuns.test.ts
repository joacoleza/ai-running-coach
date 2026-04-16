import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  createRun,
  fetchRuns,
  fetchUnlinkedRuns,
  updateRun,
  deleteRun,
  linkRun,
} from '../hooks/useRuns';

const mockFetch = vi.fn();

function mockOk(data: unknown): Promise<Response> {
  return Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response);
}

function mockError(data: unknown, status = 400): Promise<Response> {
  return Promise.resolve({
    ok: false,
    status,
    json: () => Promise.resolve(data),
  } as Response);
}

const baseRun = {
  _id: 'run-1',
  date: '2026-04-01',
  distance: 5,
  duration: '25:00',
  pace: 5.0,
  createdAt: '2026-04-01T00:00:00Z',
  updatedAt: '2026-04-01T00:00:00Z',
};

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch);
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
    if (key === 'access_token') return 'test-jwt-token';
    return null;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('createRun', () => {
  it('POSTs to /api/runs with body and returns created run', async () => {
    mockFetch.mockReturnValue(mockOk(baseRun));
    const result = await createRun({ date: '2026-04-01', distance: 5, duration: '25:00' });
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/runs',
      expect.objectContaining({ method: 'POST', body: expect.any(String) })
    );
    expect(result).toEqual(baseRun);
  });

  it('sends auth header from localStorage', async () => {
    mockFetch.mockReturnValue(mockOk(baseRun));
    await createRun({ date: '2026-04-01', distance: 5, duration: '25:00' });
    const [, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect((opts.headers as Record<string, string>)['Authorization']).toBe('Bearer test-jwt-token');
  });

  it('throws error message from response on failure', async () => {
    mockFetch.mockReturnValue(mockError({ error: 'Validation failed' }));
    await expect(createRun({ date: '2026-04-01', distance: 5, duration: '25:00' })).rejects.toThrow('Validation failed');
  });

  it('falls back to default error message when no error field', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('parse error')),
      } as unknown as Response)
    );
    await expect(createRun({ date: '2026-04-01', distance: 5, duration: '25:00' })).rejects.toThrow('Failed to create run');
  });
});

describe('fetchRuns', () => {
  it('GETs /api/runs without params', async () => {
    mockFetch.mockReturnValue(mockOk({ runs: [baseRun], total: 1, totalAll: 1 }));
    const result = await fetchRuns();
    expect(mockFetch).toHaveBeenCalledWith('/api/runs?', expect.any(Object));
    expect(result.runs).toHaveLength(1);
    expect(result.total).toBe(1);
  });

  it('appends query params when provided', async () => {
    mockFetch.mockReturnValue(mockOk({ runs: [], total: 0, totalAll: 0 }));
    await fetchRuns({ limit: 10, offset: 20, dateFrom: '2026-01-01', dateTo: '2026-12-31', distanceMin: 5, distanceMax: 20 });
    const url = (mockFetch.mock.calls[0] as [string])[0];
    expect(url).toContain('limit=10');
    expect(url).toContain('offset=20');
    expect(url).toContain('dateFrom=2026-01-01');
    expect(url).toContain('dateTo=2026-12-31');
    expect(url).toContain('distanceMin=5');
    expect(url).toContain('distanceMax=20');
  });

  it('throws on non-ok response', async () => {
    mockFetch.mockReturnValue(mockError({}, 500));
    await expect(fetchRuns()).rejects.toThrow('Failed to fetch runs');
  });
});

describe('fetchUnlinkedRuns', () => {
  it('GETs /api/runs with unlinked=true and returns runs array', async () => {
    mockFetch.mockReturnValue(mockOk({ runs: [baseRun], total: 1 }));
    const result = await fetchUnlinkedRuns();
    const url = (mockFetch.mock.calls[0] as [string])[0];
    expect(url).toContain('unlinked=true');
    expect(result).toEqual([baseRun]);
  });

  it('respects custom limit', async () => {
    mockFetch.mockReturnValue(mockOk({ runs: [], total: 0 }));
    await fetchUnlinkedRuns(50);
    const url = (mockFetch.mock.calls[0] as [string])[0];
    expect(url).toContain('limit=50');
  });

  it('throws on failure', async () => {
    mockFetch.mockReturnValue(mockError({}, 500));
    await expect(fetchUnlinkedRuns()).rejects.toThrow('Failed to fetch unlinked runs');
  });
});

describe('updateRun', () => {
  it('PATCHes /api/runs/:id and returns updated run', async () => {
    const updated = { ...baseRun, distance: 10 };
    mockFetch.mockReturnValue(mockOk(updated));
    const result = await updateRun('run-1', { distance: 10 });
    expect(mockFetch).toHaveBeenCalledWith('/api/runs/run-1', expect.objectContaining({ method: 'PATCH' }));
    expect(result.distance).toBe(10);
  });

  it('throws error message from response on failure', async () => {
    mockFetch.mockReturnValue(mockError({ error: 'Run not found' }, 404));
    await expect(updateRun('run-1', { distance: 10 })).rejects.toThrow('Run not found');
  });

  it('falls back to default error when json parse fails', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('parse error')),
      } as unknown as Response)
    );
    await expect(updateRun('run-1', {})).rejects.toThrow('Failed to update run');
  });
});

describe('deleteRun', () => {
  it('DELETEs /api/runs/:id', async () => {
    mockFetch.mockReturnValue(Promise.resolve({ ok: true, status: 204, json: () => Promise.resolve({}) } as Response));
    await deleteRun('run-1');
    expect(mockFetch).toHaveBeenCalledWith('/api/runs/run-1', expect.objectContaining({ method: 'DELETE' }));
  });

  it('throws error message from response on failure', async () => {
    mockFetch.mockReturnValue(mockError({ error: 'Cannot delete linked run' }, 409));
    await expect(deleteRun('run-1')).rejects.toThrow('Cannot delete linked run');
  });

  it('falls back to default error when json parse fails', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('parse error')),
      } as unknown as Response)
    );
    await expect(deleteRun('run-1')).rejects.toThrow('Failed to delete run');
  });
});

describe('linkRun', () => {
  it('POSTs to /api/runs/:id/link with weekNumber and dayLabel', async () => {
    const linked = { ...baseRun, weekNumber: 2, dayLabel: 'B' };
    mockFetch.mockReturnValue(mockOk(linked));
    const result = await linkRun('run-1', 2, 'B');
    expect(mockFetch).toHaveBeenCalledWith('/api/runs/run-1/link', expect.objectContaining({ method: 'POST' }));
    const body = JSON.parse((mockFetch.mock.calls[0] as [string, RequestInit])[1].body as string) as unknown;
    expect(body).toEqual({ weekNumber: 2, dayLabel: 'B' });
    expect(result.weekNumber).toBe(2);
  });

  it('throws error message from response on failure', async () => {
    mockFetch.mockReturnValue(mockError({ error: 'Day already has a linked run' }, 409));
    await expect(linkRun('run-1', 2, 'B')).rejects.toThrow('Day already has a linked run');
  });

  it('falls back to default error when json parse fails', async () => {
    mockFetch.mockReturnValue(
      Promise.resolve({
        ok: false,
        status: 500,
        json: () => Promise.reject(new Error('parse error')),
      } as unknown as Response)
    );
    await expect(linkRun('run-1', 1, 'A')).rejects.toThrow('Failed to link run');
  });
});
