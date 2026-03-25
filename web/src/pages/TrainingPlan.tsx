import { usePlan } from '../hooks/usePlan';

export function TrainingPlan() {
  const { plan, isLoading, error } = usePlan();

  if (isLoading) {
    return <div className="p-6 text-gray-400">Loading plan...</div>;
  }

  if (!plan || plan.status === 'onboarding') {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900">Training Plan</h1>
        <p className="mt-4 text-gray-600">
          {plan?.status === 'onboarding'
            ? 'Complete the onboarding in the coach panel to generate your training plan.'
            : 'Start a new plan using the coach panel to get your training schedule.'}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      </div>
    );
  }

  if (plan.status === 'active' && plan.phases?.length > 0) {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Training Plan</h1>
        {plan.objective && (
          <div className="mb-4 p-4 bg-blue-50 rounded-lg border border-blue-100">
            <span className="font-semibold">{plan.objective}</span>
            {plan.targetDate && <span className="ml-2 text-gray-600">Target: {plan.targetDate}</span>}
          </div>
        )}
        <p className="text-gray-600">{plan.phases.length} training phases loaded. Full view coming soon.</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900">Training Plan</h1>
      <p className="mt-4 text-gray-600">Your plan is being prepared.</p>
    </div>
  );
}
