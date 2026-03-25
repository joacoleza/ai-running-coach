import { usePlan } from '../hooks/usePlan';
import { useChatContext } from '../contexts/ChatContext';
import { PlanView } from '../components/plan/PlanView';
import { PlanActions } from '../components/plan/PlanActions';

export function TrainingPlan() {
  const { plan, isLoading, error, updateDay, deleteDay, archivePlan } = usePlan();
  const { startPlan } = useChatContext();

  if (isLoading) {
    return <div className="p-6 text-gray-400">Loading plan...</div>;
  }

  const hasActivePlan = !!plan && plan.status === 'active' && plan.phases?.length > 0;

  const handleCreateNew = () => {
    // Per D-12: "Create new plan" opens the coach panel in conversational mode
    void startPlan('conversational');
    window.dispatchEvent(new Event('open-coach'));
  };

  const handleUpdate = () => {
    // Per D-12: "Update plan" opens the coach panel so user can describe changes
    window.dispatchEvent(new Event('open-coach'));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Training Plan</h1>

      <PlanActions
        hasActivePlan={hasActivePlan}
        onCreateNew={handleCreateNew}
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
              <span className="font-semibold capitalize">{plan.objective.replace('-', ' ')}</span>
              {plan.targetDate && <span className="ml-2 text-gray-600">Target: {plan.targetDate}</span>}
            </div>
          )}
          <PlanView plan={plan} onUpdateDay={updateDay} onDeleteDay={deleteDay} />
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
