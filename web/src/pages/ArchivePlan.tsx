import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import type { PlanData } from '../hooks/usePlan';
import { planToMarkdown } from '../utils/planToMarkdown';

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-app-password': localStorage.getItem('app_password') ?? '',
  };
}

const mdComponents: Components = {
  h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-semibold text-gray-800 mt-5 mb-1">{children}</h2>,
  h3: ({ children }) => <h3 className="text-lg font-medium text-gray-700 mt-4 mb-1">{children}</h3>,
  p: ({ children }) => <p className="text-gray-600 text-sm mb-2">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3">{children}</ul>,
  li: ({ children }) => <li className="text-sm text-gray-700">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="text-gray-500 italic">{children}</em>,
};

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
    <div className="p-6 w-full">
      <Link to="/archive" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Back to Archive</Link>
      <div className="w-full">
        <ReactMarkdown components={mdComponents} remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
      </div>
    </div>
  );
}
