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

  return { plan, isLoading, error, refreshPlan };
}
