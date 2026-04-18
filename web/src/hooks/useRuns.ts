export interface Run {
  _id: string;
  date: string;          // ISO YYYY-MM-DD
  distance: number;
  duration: string;
  pace: number;
  avgHR?: number;
  notes?: string;
  planId?: string;
  weekNumber?: number;
  dayLabel?: string;
  insight?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateRunInput {
  date: string;           // ISO YYYY-MM-DD
  distance: number;
  duration: string;
  avgHR?: number;
  notes?: string;
  weekNumber?: number;    // provide to link to plan day
  dayLabel?: string;      // provide to link to plan day
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'X-Authorization': `Bearer ${localStorage.getItem('access_token') ?? ''}`,
  };
}

export async function createRun(input: CreateRunInput): Promise<Run> {
  const res = await fetch('/api/runs', {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to create run' }));
    throw new Error((err as { error?: string }).error ?? 'Failed to create run');
  }
  return res.json() as Promise<Run>;
}

export async function fetchRuns(params?: {
  limit?: number;
  offset?: number;
  dateFrom?: string;
  dateTo?: string;
  distanceMin?: number;
  distanceMax?: number;
}): Promise<{ runs: Run[]; total: number; totalAll: number }> {
  const query = new URLSearchParams();
  if (params?.limit !== undefined) query.set('limit', String(params.limit));
  if (params?.offset !== undefined) query.set('offset', String(params.offset));
  if (params?.dateFrom) query.set('dateFrom', params.dateFrom);
  if (params?.dateTo) query.set('dateTo', params.dateTo);
  if (params?.distanceMin !== undefined) query.set('distanceMin', String(params.distanceMin));
  if (params?.distanceMax !== undefined) query.set('distanceMax', String(params.distanceMax));
  const res = await fetch(`/api/runs?${query}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch runs');
  return res.json() as Promise<{ runs: Run[]; total: number; totalAll: number }>;
}

export async function fetchUnlinkedRuns(limit = 100): Promise<Run[]> {
  const res = await fetch(`/api/runs?unlinked=true&limit=${limit}`, { headers: authHeaders() });
  if (!res.ok) throw new Error('Failed to fetch unlinked runs');
  const data = await res.json() as { runs: Run[]; total: number };
  return data.runs;
}

export async function updateRun(
  id: string,
  updates: Partial<Pick<Run, 'date' | 'distance' | 'duration' | 'avgHR' | 'notes' | 'insight'>>
): Promise<Run> {
  const res = await fetch(`/api/runs/${id}`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to update run' }));
    throw new Error((err as { error?: string }).error ?? 'Failed to update run');
  }
  return res.json() as Promise<Run>;
}

export async function deleteRun(id: string): Promise<void> {
  const res = await fetch(`/api/runs/${id}`, {
    method: 'DELETE',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to delete run' }));
    throw new Error((err as { error?: string }).error ?? 'Failed to delete run');
  }
}

export async function linkRun(runId: string, weekNumber: number, dayLabel: string): Promise<Run> {
  const res = await fetch(`/api/runs/${runId}/link`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ weekNumber, dayLabel }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to link run' }));
    throw new Error((err as { error?: string }).error ?? 'Failed to link run');
  }
  return res.json() as Promise<Run>;
}

export async function unlinkRun(id: string): Promise<Run> {
  const res = await fetch(`/api/runs/${id}/unlink`, {
    method: 'POST',
    headers: authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: 'Failed to unlink run' }));
    throw new Error((err as { error?: string }).error ?? 'Failed to unlink run');
  }
  return res.json() as Promise<Run>;
}
