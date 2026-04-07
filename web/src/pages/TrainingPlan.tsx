import { useState, useRef, useEffect } from 'react';
import { usePlan } from '../hooks/usePlan';
import { useChatContext } from '../contexts/ChatContext';
import { PlanView } from '../components/plan/PlanView';
import { PlanActions } from '../components/plan/PlanActions';
import { RunDetailModal } from '../components/runs/RunDetailModal';
import type { Run } from '../hooks/useRuns';

function openCoachPanel() {
  window.dispatchEvent(new CustomEvent('open-coach-panel'));
}

export function TrainingPlan() {
  const { plan, linkedRuns, isLoading, error, updateDay, deleteDay, addDay, archivePlan, updatePhase, deleteLastPhase, refreshPlan } = usePlan();
  const { sendMessage } = useChatContext();
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const [isRequestingFeedback, setIsRequestingFeedback] = useState(false);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const lastCompletedRef = useRef<HTMLDivElement | null>(null);
  const dayRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());

  const hasActivePlan = !!plan && plan.status === 'active' && plan.phases?.length > 0;

  // Auto-scroll to last completed day when plan first loads
  useEffect(() => {
    if (lastCompletedRef.current) {
      lastCompletedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [hasActivePlan]);

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
          headers: { 'x-app-password': localStorage.getItem('app_password') ?? '' }
        });
        if (res.ok) setSelectedRun(await res.json() as Run);
      } catch { /* ignore */ }
    })();
  }, [selectedRunId]);

  // Listen for navigate-to-day events from RunDetailModal badge clicks
  useEffect(() => {
    const handler = (e: Event) => {
      const { weekNumber, dayLabel } = (e as CustomEvent<{ weekNumber: number; dayLabel: string }>).detail;
      const el = dayRefsMap.current.get(`${weekNumber}-${dayLabel}`);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    };
    window.addEventListener('navigate-to-day', handler);
    return () => window.removeEventListener('navigate-to-day', handler);
  }, []);

  if (isLoading) {
    return <div className="p-6 text-gray-400">Loading plan...</div>;
  }

  const handleGetFeedback = async () => {
    setIsRequestingFeedback(true);
    openCoachPanel();

    const message =
      `Please give me a progress assessment for my training plan. ` +
      `Review my completed runs, how I'm tracking toward my goal, and any adjustments you'd recommend. ` +
      `Keep it concise — 3-4 sentences.`;

    try {
      const responseText = await sendMessage(message);
      const cleanedText = responseText ? responseText.replace(/<[^>]+\/>/g, '').trim() : '';
      if (cleanedText) {
        await fetch('/api/plan', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-app-password': localStorage.getItem('app_password') ?? '',
          },
          body: JSON.stringify({ progressFeedback: cleanedText }),
        });
        // Refresh plan so the feedback section shows the new content
        await refreshPlan();
        setFeedbackExpanded(true);
        window.dispatchEvent(new Event('plan-updated'));
      }
    } catch {
      // Coach panel will show any error
    } finally {
      setIsRequestingFeedback(false);
    }
  };

  return (
    <div>
      {/* Sticky header — stays visible while scrolling through plan weeks */}
      <div className="sticky top-0 z-10 bg-gray-50 px-6 pt-6 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-3 mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Training Plan</h1>
          <PlanActions
            hasActivePlan={hasActivePlan}
            onArchive={() => { void archivePlan(); }}
          />
        </div>

        {error && (
          <div className="my-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
        )}

        {hasActivePlan && plan && (
          <>
            {plan.objective && (
              <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <span className="font-semibold capitalize">{plan.objective.replace('-', ' ')}</span>
                  {plan.targetDate && <span className="text-gray-600">Target: {plan.targetDate}</span>}
                </div>
              </div>
            )}

            {/* Coach Feedback Panel */}
            <div className="mt-2 mb-4 border border-gray-200 rounded-lg overflow-hidden">
              {/* Panel header — always visible */}
              <div className="flex items-center justify-between p-3 bg-gray-50">
                <span className="text-sm font-medium text-gray-700">Coach Feedback</span>
                <button
                  onClick={() => { void handleGetFeedback(); }}
                  disabled={isRequestingFeedback}
                  className="cursor-pointer text-xs text-blue-600 hover:text-blue-800 underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRequestingFeedback
                    ? 'Requesting...'
                    : plan.progressFeedback
                    ? 'Refresh feedback'
                    : 'Get plan feedback'}
                </button>
              </div>

              {/* Expandable content — only renders when feedback exists */}
              {plan.progressFeedback && (
                <>
                  <button
                    onClick={() => setFeedbackExpanded(!feedbackExpanded)}
                    className="cursor-pointer w-full flex items-center justify-between px-3 py-1.5 border-t border-gray-100 bg-gray-50 text-xs text-gray-500 hover:bg-gray-100"
                  >
                    <span>{feedbackExpanded ? 'Hide' : 'Show'}</span>
                    <span>{feedbackExpanded ? '▲' : '▼'}</span>
                  </button>
                  {feedbackExpanded && (
                    <div className="p-3 text-sm text-gray-700">
                      <div className="space-y-3">
                        {plan.progressFeedback.split('\n\n').map((paragraph, i) => (
                          <p key={i}>{paragraph}</p>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Scrollable content area — PlanView and empty states */}
      <div className="px-6 pt-4 pb-6">
        {hasActivePlan && plan ? (
          <PlanView plan={plan} linkedRuns={linkedRuns} onUpdateDay={updateDay} onDeleteDay={deleteDay} onAddDay={addDay} onUpdatePhase={updatePhase} onDeletePhase={deleteLastPhase} lastCompletedDayRef={lastCompletedRef} dayRefsMap={dayRefsMap} />
        ) : !plan || plan.status === 'onboarding' ? (
          <p className="mt-4 text-gray-600">
            {plan?.status === 'onboarding'
              ? 'Complete the onboarding in the coach panel to generate your training plan.'
              : 'No active plan. Create a new one using the coach.'}
          </p>
        ) : null}
      </div>

      {/* RunDetailModal — opened by clicking a completed day's run date */}
      {selectedRun && (
        <RunDetailModal
          run={selectedRun}
          activePlanId={plan?._id}
          onClose={() => { setSelectedRun(null); setSelectedRunId(null); }}
          onUpdated={(updated) => setSelectedRun(updated)}
          onDeleted={() => { setSelectedRun(null); setSelectedRunId(null); void refreshPlan(); }}
        />
      )}
    </div>
  );
}
