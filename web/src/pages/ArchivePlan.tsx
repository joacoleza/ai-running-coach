import { useState, useEffect } from 'react';
import { useParams, Link, useLocation } from 'react-router-dom';
import type { PlanData } from '../hooks/usePlan';
import { PlanView } from '../components/plan/PlanView';
import { RunDetailModal } from '../components/runs/RunDetailModal';
import type { Run } from '../hooks/useRuns';
import { CoachPanel } from '../components/coach/CoachPanel';
import { useAuth } from '../contexts/AuthContext';

export function ArchivePlan() {
  const { token } = useAuth();
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [linkedRuns, setLinkedRuns] = useState<Map<string, Run>>(new Map());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panelOpen, setPanelOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChatHistory(planId: string) {
      setChatLoading(true);
      try {
        const res = await fetch(`/api/messages?planId=${planId}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Authorization': `Bearer ${token ?? ''}`,
          },
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
        const res = await fetch(`/api/plans/archived/${id}`, {
          headers: {
            'Content-Type': 'application/json',
            'X-Authorization': `Bearer ${token ?? ''}`,
          },
        });
        if (!res.ok) throw new Error('Failed to fetch plan');
        const data = await res.json();
        const fetchedPlan = (data as { plan?: PlanData; linkedRuns?: Record<string, Run> }).plan ?? null;
        setPlan(fetchedPlan);
        const rawLinkedRuns = (data as { plan?: PlanData; linkedRuns?: Record<string, Run> }).linkedRuns ?? {};
        setLinkedRuns(new Map(Object.entries(rawLinkedRuns)));
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

  // Listen for open-run-detail events from DayRow run date clicks
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ runId: string }>).detail;
      setSelectedRunId(detail.runId);
    };
    window.addEventListener('open-run-detail', handler);
    return () => window.removeEventListener('open-run-detail', handler);
  }, []);

  // Fetch the run when selectedRunId changes
  useEffect(() => {
    if (!selectedRunId) return;
    void (async () => {
      try {
        const res = await fetch(`/api/runs/${selectedRunId}`, {
          headers: { 'X-Authorization': `Bearer ${token ?? ''}` },
        });
        if (res.ok) setSelectedRun(await res.json() as Run);
      } catch { /* ignore */ }
    })();
  }, [selectedRunId]);

  if (isLoading) return <div className="p-6 text-gray-400">Loading plan...</div>;
  if (error) return <div className="p-6 text-red-600">{error}</div>;
  if (!plan) return <div className="p-6 text-gray-600">Plan not found.</div>;

  return (
    <div className="flex flex-1 overflow-hidden h-full">
      {/* Plan content — scrollable */}
      <div className="flex-1 overflow-y-auto p-6">
        <Link to="/archive" className="text-blue-600 hover:underline text-sm mb-4 inline-block">&larr; Back to Archive</Link>
        <div className="w-full">
          <PlanView
            plan={plan}
            linkedRuns={linkedRuns}
            onUpdateDay={async () => {}}
            onDeleteDay={async () => {}}
            readonly={true}
          />
        </div>
      </div>

      {/* RunDetailModal — opened when a linked run date is clicked */}
      {selectedRun && (
        <RunDetailModal
          run={selectedRun}
          onClose={() => { setSelectedRun(null); setSelectedRunId(null); }}
          onUpdated={(updated) => setSelectedRun(updated)}
          onDeleted={() => { setSelectedRun(null); setSelectedRunId(null); }}
        />
      )}

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
