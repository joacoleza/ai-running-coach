import type { PlanData } from '../../hooks/usePlan';
import { DayRow } from './DayRow';

interface PlanViewProps {
  plan: PlanData;
  onUpdateDay: (date: string, updates: Record<string, string>) => Promise<void>;
  onDeleteDay: (date: string) => Promise<void>;
  readonly?: boolean;
}

export function PlanView({ plan, onUpdateDay, onDeleteDay, readonly }: PlanViewProps) {
  return (
    <div>
      {plan.phases.map(phase => (
        <section key={phase.name} className="mb-8">
          <h2 className="text-xl font-bold text-gray-900">{phase.name}</h2>
          {phase.description && <p className="text-gray-600 italic mb-2">{phase.description}</p>}
          {phase.weeks.map(week => (
            <div key={week.weekNumber} className="mb-4">
              <h3 className="text-lg font-semibold text-gray-800 mb-2">Week {week.weekNumber}</h3>
              <div className="space-y-1">
                {week.days.map(day => (
                  <DayRow key={day.date} day={day} onUpdate={onUpdateDay} onDelete={onDeleteDay} readonly={readonly} />
                ))}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
