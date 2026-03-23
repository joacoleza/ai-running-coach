import { useState } from 'react';
import { usePlan } from '../hooks/usePlan';
import type { PlanSession } from '../hooks/usePlan';
import { PlanCalendar } from '../components/plan/PlanCalendar';
import { SessionModal } from '../components/plan/SessionModal';

export function TrainingPlan() {
  const { plan, isLoading, error, updateSession } = usePlan();
  const [selectedSession, setSelectedSession] = useState<PlanSession | null>(null);

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

  const units = plan.goal?.units || 'km';

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-gray-900 mb-4">Training Plan</h1>

      {/* Goal summary (D-04: visible, not editable) */}
      {plan.goal && plan.goal.eventType && (
        <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
          <div className="flex flex-wrap gap-4 text-sm text-gray-700">
            <span><strong>Goal:</strong> {plan.goal.eventType}</span>
            <span><strong>Target:</strong> {plan.goal.targetDate}</span>
            <span><strong>Weekly mileage:</strong> {plan.goal.weeklyMileage} {units}</span>
            <span><strong>Days/week:</strong> {plan.goal.availableDays}</span>
            <span><strong>Units:</strong> {units}</span>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">{error}</div>
      )}

      <PlanCalendar
        sessions={plan.sessions}
        units={units}
        onSelectSession={setSelectedSession}
      />

      {selectedSession && (
        <SessionModal
          session={selectedSession}
          units={units}
          onSave={updateSession}
          onClose={() => setSelectedSession(null)}
        />
      )}
    </div>
  );
}
