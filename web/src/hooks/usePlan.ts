import { useState, useEffect, useCallback } from 'react';

export interface PlanDay {
  date: string;
  type: 'run' | 'rest' | 'cross-train';
  objective?: { kind: 'distance' | 'time'; value: number; unit: 'km' | 'min'; };
  guidelines: string;
  completed: boolean;
  skipped: boolean;
}

export interface PlanWeek {
  weekNumber: number;
  startDate: string;
  days: PlanDay[];
}

export interface PlanPhase {
  name: string;
  description: string;
  weeks: PlanWeek[];
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
  status: 'onboarding' | 'active' | 'archived';
  onboardingMode: 'conversational' | 'paste';
  onboardingStep: number;
  goal: PlanGoal;
  objective?: 'marathon' | 'half-marathon' | '15km' | '10km' | '5km';
  targetDate?: string;
  phases: PlanPhase[];
}

interface UsePlanReturn {
  plan: PlanData | null;
  isLoading: boolean;
  error: string | null;
  refreshPlan: () => Promise<void>;
  updateDay: (date: string, updates: Record<string, string>) => Promise<void>;
  deleteDay: (date: string) => Promise<void>;
  archivePlan: () => Promise<void>;
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

  const updateDay = useCallback(async (date: string, updates: Record<string, string>) => {
    const res = await fetch(`/api/plan/days/${date}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Failed to update day' }));
      throw new Error((errData as { error?: string }).error ?? 'Failed to update day');
    }
    await refreshPlan();
  }, [refreshPlan]);

  const deleteDay = useCallback(async (date: string) => {
    const res = await fetch(`/api/plan/days/${date}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Failed to delete day' }));
      throw new Error((errData as { error?: string }).error ?? 'Failed to delete day');
    }
    await refreshPlan();
  }, [refreshPlan]);

  const archivePlan = useCallback(async () => {
    const res = await fetch('/api/plan/archive', {
      method: 'POST',
      headers: authHeaders(),
    });
    if (!res.ok) throw new Error('Failed to archive plan');
    setPlan(null);
    window.dispatchEvent(new Event('plan-archived'));
  }, []);

  useEffect(() => { refreshPlan(); }, [refreshPlan]);

  useEffect(() => {
    const handler = () => { void refreshPlan(); };
    window.addEventListener('plan-updated', handler);
    return () => window.removeEventListener('plan-updated', handler);
  }, [refreshPlan]);

  return { plan, isLoading, error, refreshPlan, updateDay, deleteDay, archivePlan };
}
