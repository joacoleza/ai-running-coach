import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import type { PlanData } from '../hooks/usePlan';
import { planToMarkdown } from '../utils/planToMarkdown';

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-app-password': localStorage.getItem('app_password') ?? '',
  };
}

export function ArchivePlan() {
  const { id } = useParams<{ id: string }>();
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchPlan() {
      try {
        const res = await fetch(`/api/plans/archived/${id}`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to fetch plan');
        const data = await res.json();
        setPlan((data as { plan?: PlanData }).plan ?? null);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plan');
      } finally {
        setIsLoading(false);
      }
    }
    if (id) void fetchPlan();
  }, [id]);

  if (isLoading) return <div className="p-6 text-gray-400">Loading plan...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!plan) return <div className="p-6 text-gray-600">Plan not found.</div>;

  const markdown = planToMarkdown(plan);

  return (
    <div className="p-6">
      <Link to="/archive" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Back to Archive</Link>
      <div className="prose prose-sm max-w-none">
        <ReactMarkdown>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
