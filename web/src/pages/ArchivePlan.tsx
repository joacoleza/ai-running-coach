import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import type { PlanData } from '../hooks/usePlan';
import { planToMarkdown } from '../utils/planToMarkdown';
import { CoachPanel } from '../components/coach/CoachPanel';

function authHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-app-password': localStorage.getItem('app_password') ?? '',
  };
}

const mdComponents: Components = {
  h1: ({ children }) => <h1 className="text-2xl font-bold text-gray-900 mt-6 mb-2">{children}</h1>,
  h2: ({ children }) => <h2 className="text-xl font-semibold text-gray-800 mt-5 mb-1">{children}</h2>,
  h3: ({ children }) => {
    const text = typeof children === 'string' ? children : Array.isArray(children) ? children.join('') : '';
    const weekMatch = text.match(/^Week (\d+)$/);
    const id = weekMatch ? `week-${weekMatch[1]}` : undefined;
    return <h3 id={id} className="text-lg font-medium text-gray-700 mt-4 mb-1">{children}</h3>;
  },
  p: ({ children }) => <p className="text-gray-600 text-sm mb-2">{children}</p>,
  ul: ({ children }) => <ul className="list-disc list-inside space-y-1 mb-3">{children}</ul>,
  li: ({ children }) => <li className="text-sm text-gray-700">{children}</li>,
  strong: ({ children }) => <strong className="font-semibold text-gray-900">{children}</strong>,
  em: ({ children }) => <em className="text-gray-500 italic">{children}</em>,
};

export function ArchivePlan() {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);

  useEffect(() => {
    async function fetchChatHistory(planId: string) {
      setChatLoading(true);
      try {
        const res = await fetch(`/api/messages?planId=${planId}`, {
          headers: authHeaders(),
        });
        if (!res.ok) return;
        const data = await res.json() as { messages: Array<{ role: 'user' | 'assistant'; content: string }> };
        setChatMessages(data.messages.map(m => ({ role: m.role, content: m.content })));
      } catch {
        // non-fatal — panel just shows empty
      } finally {
        setChatLoading(false);
      }
    }

    async function fetchPlan() {
      try {
        const res = await fetch(`/api/plans/archived/${id}`, { headers: authHeaders() });
        if (!res.ok) throw new Error('Failed to fetch plan');
        const data = await res.json();
        const fetchedPlan = (data as { plan?: PlanData }).plan ?? null;
        setPlan(fetchedPlan);
        if (fetchedPlan?._id) {
          void fetchChatHistory(fetchedPlan._id);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load plan');
      } finally {
        setIsLoading(false);
      }
    }
    if (id) void fetchPlan();
  }, [id]);

  // Scroll to the linked week after plan renders
  useEffect(() => {
    if (!plan) return;
    const scrollToWeek = (location.state as { scrollToWeek?: number } | null)?.scrollToWeek;
    if (scrollToWeek) {
      const el = document.getElementById(`week-${scrollToWeek}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return <div className="p-6 text-gray-400">Loading plan...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!plan) return <div className="p-6 text-gray-600">Plan not found.</div>;

  const markdown = planToMarkdown(plan);

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* Plan content — scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        <Link to="/archive" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Back to Archive</Link>
        <div className="w-full">
          <ReactMarkdown components={mdComponents} remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
        </div>
      </div>

      {/* Readonly CoachPanel — right column on desktop, overlay on mobile */}
      <CoachPanel
        isOpen={panelOpen}
        onClose={() => setPanelOpen(false)}
        readonly={true}
        initialMessages={chatLoading ? [] : chatMessages}
      />

      {/* Mobile FAB — gray-500, history/clock icon, opens readonly panel */}
      {!panelOpen && (
        <button
          onClick={() => setPanelOpen(true)}
          aria-label="View plan history"
          className="cursor-pointer fixed bottom-6 right-4 z-40 bg-gray-500 text-white shadow-lg w-14 h-14 rounded-full flex items-center justify-center hover:bg-gray-600 transition-transform active:scale-95 md:hidden"
        >
          {/* Clock icon — inline SVG */}
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      )}
    </div>
  );
}
