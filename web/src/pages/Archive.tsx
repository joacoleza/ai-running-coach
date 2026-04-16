import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ArchivedPlanSummary {
  _id: string;
  objective?: string;
  goal?: { eventType?: string; targetDate?: string };
  targetDate?: string;
  createdAt: string;
  status: string;
}

function formatDate(dateStr?: string): string | null {
  if (!dateStr) return null;
  try {
    return new Date(dateStr).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

export function Archive() {
  const { token } = useAuth();
  const [plans, setPlans] = useState<ArchivedPlanSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchArchived() {
      try {
        const res = await fetch('/api/plans/archived', {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token ?? ''}`,
          },
        });
        if (!res.ok) throw new Error('Failed to fetch archived plans');
        const data = await res.json();
        setPlans((data as { plans?: ArchivedPlanSummary[] }).plans ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load archive');
      } finally {
        setIsLoading(false);
      }
    }
    void fetchArchived();
  }, []);

  if (isLoading) return <div className="p-6 text-gray-400">Loading archive...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Archive</h1>
      {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>}
      {plans.length === 0 ? (
        <p className="text-gray-600">No archived plans yet.</p>
      ) : (
        <div className="space-y-2">
          {plans.map(p => {
            const title = (p.objective ?? p.goal?.eventType ?? 'Training Plan').replace(/-/g, ' ');
            const targetDate = formatDate(p.targetDate ?? p.goal?.targetDate);
            return (
              <Link
                key={p._id}
                to={`/archive/${p._id}`}
                className="block p-4 bg-white border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-sm transition-all"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-gray-900 capitalize">{title}</span>
                    {targetDate && (
                      <span className="ml-2 text-sm text-gray-500">· Target: {targetDate}</span>
                    )}
                  </div>
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                    Archived
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
