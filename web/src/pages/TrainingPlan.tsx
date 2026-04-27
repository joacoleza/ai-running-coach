import { useState, useRef, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate, useLocation } from 'react-router-dom';
import { usePlan } from '../hooks/usePlan';
import { useChatContext } from '../contexts/ChatContext';
import { useAuth } from '../contexts/AuthContext';
import { PlanView } from '../components/plan/PlanView';
import { PlanActions } from '../components/plan/PlanActions';
import { RunDetailModal } from '../components/runs/RunDetailModal';
import { computePlanAdherence } from '../hooks/useDashboard';
import type { Run } from '../hooks/useRuns';

function openCoachPanel() {
  window.dispatchEvent(new CustomEvent('open-coach-panel'));
}

export function TrainingPlan() {
  const { token } = useAuth();
  const { plan, linkedRuns, isLoading, error, updateDay, deleteDay, addDay, archivePlan, updatePhase, deleteLastPhase, refreshPlan, addPhase, addWeek, deleteLastWeek } = usePlan();
  const { sendMessage } = useChatContext();
  const navigate = useNavigate();
  const location = useLocation();
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const [isRequestingFeedback, setIsRequestingFeedback] = useState(false);
  const [selectedRun, setSelectedRun] = useState<Run | null>(null);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const lastCompletedRef = useRef<HTMLDivElement | null>(null);
  const dayRefsMap = useRef<Map<string, HTMLDivElement>>(new Map());
  const [editingDate, setEditingDate] = useState(false);
  const [dateValue, setDateValue] = useState(plan?.targetDate ?? '');
  const dateInputRef = useRef<HTMLInputElement>(null);

  const hasActivePlan = !!plan && plan.status === 'active' && plan.phases?.length > 0;

  // Scroll to a specific day if navigated here from RunDetailModal badge, otherwise
  // fall back to auto-scrolling to the last completed day.
  useEffect(() => {
    if (!hasActivePlan) return;
    const scrollToDay = (location.state as { scrollToDay?: string } | null)?.scrollToDay;
    if (scrollToDay) {
      const el = dayRefsMap.current.get(scrollToDay);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        navigate('/plan', { replace: true, state: null });
      }
    } else if (lastCompletedRef.current) {
      lastCompletedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [hasActivePlan]); // eslint-disable-line react-hooks/exhaustive-deps

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
          headers: { 'X-Authorization': `Bearer ${token ?? ''}` }
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

  // Sync dateValue when plan changes (e.g. after agent update)
  useEffect(() => {
    setDateValue(plan?.targetDate ?? '');
  }, [plan?.targetDate]);

  // Focus date input when editing opens
  useEffect(() => {
    if (editingDate) dateInputRef.current?.focus();
  }, [editingDate]);

  const saveDate = useCallback(async () => {
    const trimmed = dateValue.trim();
    if (trimmed === (plan?.targetDate ?? '')) {
      setEditingDate(false);
      return;
    }
    try {
      await fetch('/api/plan', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-app-password': localStorage.getItem('app_password') ?? '',
        },
        body: JSON.stringify({ targetDate: trimmed }),
      });
      await refreshPlan();
    } finally {
      setEditingDate(false);
    }
  }, [dateValue, plan?.targetDate, refreshPlan]);

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
                <div className="flex flex-wrap items-baseline gap-x-2 mb-2">
                  <span className="font-semibold capitalize">{plan.objective.replace('-', ' ')}</span>
                  {editingDate ? (
                    <input
                      ref={dateInputRef}
                      type="date"
                      value={dateValue}
                      min="2000-01-01"
                      onChange={(e) => setDateValue(e.target.value)}
                      onBlur={() => void saveDate()}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void saveDate();
                        if (e.key === 'Escape') {
                          setDateValue(plan.targetDate ?? '');
                          setEditingDate(false);
                        }
                      }}
                      className="border-b-2 border-blue-400 outline-none bg-transparent text-[16px]"
                    />
                  ) : plan.targetDate ? (
                    <span
                      className="cursor-pointer text-gray-600 hover:text-blue-700"
                      onClick={() => setEditingDate(true)}
                    >
                      Target: {plan.targetDate}
                    </span>
                  ) : (
                    <span
                      className="cursor-pointer text-gray-400 text-sm hover:text-blue-600"
                      onClick={() => setEditingDate(true)}
                    >
                      + Set target date
                    </span>
                  )}
                </div>
                {(() => {
                  const { adherence, progress } = computePlanAdherence(plan);
                  return (
                    <div className="flex gap-4 text-sm text-gray-600">
                      <span>
                        <span className="font-medium text-gray-800">{adherence}</span>
                        {' '}adherence
                      </span>
                      <span>
                        <span className="font-medium text-gray-800">{progress}</span>
                        {' '}progress
                      </span>
                    </div>
                  );
                })()}
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
                    <div className="p-3 text-sm text-gray-700 prose prose-sm max-w-none">
                      <ReactMarkdown>{plan.progressFeedback}</ReactMarkdown>
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
          <PlanView plan={plan} linkedRuns={linkedRuns} onUpdateDay={updateDay} onDeleteDay={deleteDay} onAddDay={addDay} onUpdatePhase={updatePhase} onDeletePhase={deleteLastPhase} onAddPhase={addPhase} onAddWeek={addWeek} onDeleteLastWeek={deleteLastWeek} lastCompletedDayRef={lastCompletedRef} dayRefsMap={dayRefsMap} />
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
