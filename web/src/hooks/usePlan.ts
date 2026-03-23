import { useState, useEffect, useCallback } from 'react';

export interface PlanSession {
  id: string;
  date: string;
  distance: number;
  duration?: number;
  avgPace?: string;
  avgBpm?: number;
  notes: string;
  completed: boolean;
}

export interface PlanGoal {
  eventType: string;
  targetDate: string;
  weeklyMileage: number;
  availableDays: number;
  units: string;
}

export interface PlanData {
  _id: string;
  status: string;
  goal: PlanGoal;
  sessions: PlanSession[];
}

interface UsePlanReturn {
  plan: PlanData | null;
  isLoading: boolean;
  error: string | null;
  refreshPlan: () => Promise<void>;
  updateSession: (sessionId: string, updates: Partial<PlanSession>) => Promise<void>;
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-app-password': localStorage.getItem('app_password') ?? '',
  };
}

export function usePlan(): UsePlanReturn {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPlan = useCallback(async () => {
    try {
      const res = await fetch('/api/plan', { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch plan');
      const data = await res.json();
      setPlan(data.plan ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { refreshPlan(); }, [refreshPlan]);

  const updateSession = useCallback(async (sessionId: string, updates: Partial<PlanSession>) => {
    const res = await fetch(`/api/sessions/${sessionId}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update session');
    // Refresh plan to get updated state
    await refreshPlan();
  }, [refreshPlan]);

  return { plan, isLoading, error, refreshPlan, updateSession };
}
