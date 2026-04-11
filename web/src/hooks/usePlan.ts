import { useState, useEffect, useCallback } from 'react';
import type { Run } from './useRuns';

export interface PlanDay {
  label: string;         // "A"-"G" for non-rest days, "" for rest days
  type: 'run' | 'rest' | 'cross-train';
  objective?: { kind: 'distance' | 'time'; value: number; unit: 'km' | 'min'; };
  guidelines: string;
  completed: boolean;
  skipped: boolean;
}

export interface PlanWeek {
  weekNumber: number;    // globally sequential across all phases
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
  progressFeedback?: string;
}

interface UsePlanReturn {
  plan: PlanData | null;
  linkedRuns: Map<string, Run>;
  isLoading: boolean;
  error: string | null;
  refreshPlan: () => Promise<void>;
  updateDay: (weekNumber: number, label: string, updates: Record<string, string>) => Promise<void>;
  deleteDay: (weekNumber: number, label: string) => Promise<void>;
  addDay: (phaseName: string, weekNumber: number, fields: Record<string, string>) => Promise<void>;
  archivePlan: () => Promise<void>;
  updatePhase: (phaseIndex: number, updates: { name?: string; description?: string }) => Promise<void>;
  deleteLastPhase: () => Promise<void>;
  addPhase: (name?: string, description?: string) => Promise<void>;
}

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-app-password': localStorage.getItem('app_password') ?? '',
  };
}

export function usePlan(): UsePlanReturn {
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [linkedRuns, setLinkedRuns] = useState<Map<string, Run>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshPlan = useCallback(async () => {
    try {
      const res = await fetch('/api/plan', { headers: authHeaders() });
      if (!res.ok) throw new Error('Failed to fetch plan');
      const data = await res.json() as { plan?: PlanData | null; linkedRuns?: Record<string, Run> };
      setPlan(data.plan ?? null);
      // Convert the plain object from JSON into a Map for O(1) lookup
      const runsRecord = data.linkedRuns ?? {};
      setLinkedRuns(new Map(Object.entries(runsRecord)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plan');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateDay = useCallback(async (weekNumber: number, label: string, updates: Record<string, string>) => {
    const res = await fetch(`/api/plan/days/${weekNumber}/${label}`, {
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

  const deleteDay = useCallback(async (weekNumber: number, label: string) => {
    const res = await fetch(`/api/plan/days/${weekNumber}/${label}`, {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Failed to remove day' }));
      throw new Error((errData as { error?: string }).error ?? 'Failed to remove day');
    }
    await refreshPlan();
  }, [refreshPlan]);

  const addDay = useCallback(async (phaseName: string, weekNumber: number, fields: Record<string, string>) => {
    const res = await fetch('/api/plan/days', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ phaseName, weekNumber, label: fields.label, ...fields }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Failed to add day' }));
      throw new Error((errData as { error?: string }).error ?? 'Failed to add day');
    }
    await refreshPlan();
  }, [refreshPlan]);

  const updatePhase = useCallback(async (phaseIndex: number, updates: { name?: string; description?: string }) => {
    const res = await fetch(`/api/plan/phases/${phaseIndex}`, {
      method: 'PATCH',
      headers: authHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Failed to update phase' }));
      throw new Error((errData as { error?: string }).error ?? 'Failed to update phase');
    }
    await refreshPlan();
  }, [refreshPlan]);

  const deleteLastPhase = useCallback(async () => {
    const res = await fetch('/api/plan/phases/last', {
      method: 'DELETE',
      headers: authHeaders(),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Failed to delete phase' }));
      throw new Error((errData as { error?: string }).error ?? 'Failed to delete phase');
    }
    await refreshPlan();
  }, [refreshPlan]);

  const addPhase = useCallback(async (name?: string, description?: string) => {
    const res = await fetch('/api/plan/phases', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify({ name, description }),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Failed to add phase' })) as { error?: string };
      throw new Error(errData.error ?? 'Failed to add phase');
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

  return { plan, linkedRuns, isLoading, error, refreshPlan, updateDay, deleteDay, addDay, archivePlan, updatePhase, deleteLastPhase, addPhase };
}
