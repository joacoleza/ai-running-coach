import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { usePlan } from '../hooks/usePlan';
import { useChatContext } from '../contexts/ChatContext';
import { PlanView } from '../components/plan/PlanView';
import { PlanActions } from '../components/plan/PlanActions';

function openCoachPanel() {
  window.dispatchEvent(new CustomEvent('open-coach-panel'));
}

export function TrainingPlan() {
  const { plan, isLoading, error, updateDay, deleteDay, addDay, archivePlan, updatePhase, deleteLastPhase, refreshPlan } = usePlan();
  const { sendMessage } = useChatContext();
  const [feedbackExpanded, setFeedbackExpanded] = useState(false);
  const [isRequestingFeedback, setIsRequestingFeedback] = useState(false);

  if (isLoading) {
    return <div className="p-6 text-gray-400">Loading plan...</div>;
  }

  const hasActivePlan = !!plan && plan.status === 'active' && plan.phases?.length > 0;

  const handleUpdate = () => {
    window.dispatchEvent(new Event('open-coach'));
  };

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
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Training Plan</h1>

      <PlanActions
        hasActivePlan={hasActivePlan}
        onUpdate={handleUpdate}
        onArchive={() => { void archivePlan(); }}
      />

      {error && (
        <div className="my-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      )}

      {hasActivePlan && plan ? (
        <>
          {plan.objective && (
            <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-semibold capitalize">{plan.objective.replace('-', ' ')}</span>
                {plan.targetDate && <span className="text-gray-600">Target: {plan.targetDate}</span>}
              </div>
              <div className="mt-2">
                <button
                  onClick={() => { void handleGetFeedback(); }}
                  disabled={isRequestingFeedback}
                  className="cursor-pointer text-sm text-blue-600 hover:text-blue-800 underline disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRequestingFeedback ? 'Requesting...' : 'Get plan feedback'}
                </button>
              </div>
            </div>
          )}

          {/* Coach Feedback collapsible section */}
          {plan.progressFeedback && (
            <div className="mt-4 mb-4 border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => setFeedbackExpanded(!feedbackExpanded)}
                className="cursor-pointer w-full flex items-center justify-between p-3 bg-gray-50 text-sm font-medium text-gray-700 hover:bg-gray-100"
              >
                <span>Coach Feedback</span>
                <span>{feedbackExpanded ? '▲' : '▼'}</span>
              </button>
              {feedbackExpanded && (
                <div className="p-3 text-sm text-gray-700 prose prose-sm max-w-none">
                  <ReactMarkdown>{plan.progressFeedback}</ReactMarkdown>
                </div>
              )}
            </div>
          )}

          <PlanView plan={plan} onUpdateDay={updateDay} onDeleteDay={deleteDay} onAddDay={addDay} onUpdatePhase={updatePhase} onDeletePhase={deleteLastPhase} />
        </>
      ) : !plan || plan.status === 'onboarding' ? (
        <p className="mt-4 text-gray-600">
          {plan?.status === 'onboarding'
            ? 'Complete the onboarding in the coach panel to generate your training plan.'
            : 'No active plan. Create a new one using the coach.'}
        </p>
      ) : null}
    </div>
  );
}
