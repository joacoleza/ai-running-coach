import { useState } from 'react';
import type { PlanData } from '../../hooks/usePlan';
import { DayRow } from './DayRow';

// Compute Mon–Sun dates for the calendar week containing startDate
function getWeekDays(startDate: string): { date: string; label: string }[] {
  const d = new Date(startDate + 'T12:00:00');
  const dow = d.getDay(); // 0=Sun, 1=Mon, …, 6=Sat
  const daysFromMon = dow === 0 ? 6 : dow - 1;
  const monday = new Date(d);
  monday.setDate(d.getDate() - daysFromMon);

  return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((label, i) => {
    const day = new Date(monday);
    day.setDate(monday.getDate() + i);
    const y = day.getFullYear();
    const m = String(day.getMonth() + 1).padStart(2, '0');
    const dd = String(day.getDate()).padStart(2, '0');
    return { date: `${y}-${m}-${dd}`, label };
  });
}

interface AddDayFormProps {
  weekStartDate: string;
  existingDates: string[];
  onSave: (fields: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}

function AddDayForm({ weekStartDate, existingDates, onSave, onCancel }: AddDayFormProps) {
  const [selectedDate, setSelectedDate] = useState('');
  const [objectiveValue, setObjectiveValue] = useState('');
  const [objectiveUnit, setObjectiveUnit] = useState<'km' | 'min'>('km');
  const [guidelines, setGuidelines] = useState('');

  const weekDays = getWeekDays(weekStartDate);

  const hasValidObjective = objectiveValue.trim() !== '' && !isNaN(Number(objectiveValue)) && Number(objectiveValue) > 0;

  const handleSave = async () => {
    if (!selectedDate || !hasValidObjective) return;
    const fields: Record<string, string> = {
      date: selectedDate,
      type: 'run',
      guidelines,
      objective_kind: objectiveUnit === 'min' ? 'time' : 'distance',
      objective_value: objectiveValue,
      objective_unit: objectiveUnit,
    };
    await onSave(fields);
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-1 px-2 text-sm bg-blue-50 rounded mt-1">
      {/* Day-of-week selector — disabled for days that already have a workout */}
      <div className="flex gap-1">
        {weekDays.map(({ date, label }) => {
          const taken = existingDates.includes(date);
          const selected = selectedDate === date;
          return (
            <button
              key={date}
              disabled={taken}
              onClick={() => setSelectedDate(date)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                taken
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : selected
                  ? 'cursor-pointer bg-blue-600 text-white'
                  : 'cursor-pointer bg-white border border-blue-300 text-blue-700 hover:bg-blue-50'
              }`}
              title={taken ? `${date} already has a workout` : date}
            >
              {label}
            </button>
          );
        })}
      </div>
      <input
        type="number"
        placeholder="distance/time"
        value={objectiveValue}
        onChange={(e) => setObjectiveValue(e.target.value)}
        className="w-24 border border-blue-400 rounded px-1 text-sm"
      />
      <select
        value={objectiveUnit}
        onChange={(e) => setObjectiveUnit(e.target.value as 'km' | 'min')}
        className="border border-blue-400 rounded px-1 text-sm"
      >
        <option value="km">km</option>
        <option value="min">min</option>
      </select>
      <input
        type="text"
        placeholder="guidelines (optional)"
        value={guidelines}
        onChange={(e) => setGuidelines(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') void handleSave(); if (e.key === 'Escape') onCancel(); }}
        className="flex-1 min-w-32 border border-blue-400 rounded px-1 text-sm"
      />
      <button
        onClick={() => void handleSave()}
        disabled={!selectedDate || !hasValidObjective}
        className="cursor-pointer text-blue-600 hover:text-blue-800 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Add
      </button>
      <button
        onClick={onCancel}
        className="cursor-pointer text-gray-400 hover:text-gray-600 text-xs"
      >
        Cancel
      </button>
    </div>
  );
}

interface PlanViewProps {
  plan: PlanData;
  onUpdateDay: (date: string, updates: Record<string, string>) => Promise<void>;
  onDeleteDay: (date: string) => Promise<void>;
  onAddDay?: (phaseName: string, weekNumber: number, fields: Record<string, string>) => Promise<void>;
  readonly?: boolean;
}

export function PlanView({ plan, onUpdateDay, onDeleteDay, onAddDay, readonly }: PlanViewProps) {
  const [addingDayTo, setAddingDayTo] = useState<{ phaseName: string; weekNumber: number } | null>(null);

  return (
    <div>
      {plan.phases.map(phase => (
        <section key={phase.name} className="mb-8">
          <h2 className="text-xl font-bold text-gray-900">{phase.name}</h2>
          {phase.description && <p className="text-gray-600 italic mb-2">{phase.description}</p>}
          {phase.weeks.map(week => {
            // Filter out rest days and sort by date
            const activeDays = week.days
              .filter(d => d.type !== 'rest')
              .slice()
              .sort((a, b) => a.date.localeCompare(b.date));

            const isAddingHere =
              addingDayTo?.phaseName === phase.name &&
              addingDayTo?.weekNumber === week.weekNumber;

            return (
              <div key={week.weekNumber} className="mb-4">
                <h3 className="text-lg font-semibold text-gray-800 mb-2">Week {week.weekNumber}</h3>
                <div className="space-y-1">
                  {activeDays.map(day => (
                    <DayRow
                      key={day.date}
                      day={day}
                      onUpdate={onUpdateDay}
                      onDelete={onDeleteDay}
                      readonly={readonly}
                      weekExistingDates={activeDays.filter(d => d.date !== day.date).map(d => d.date)}
                    />
                  ))}
                </div>
                {!readonly && onAddDay && (
                  isAddingHere ? (
                    <AddDayForm
                      weekStartDate={week.startDate}
                      existingDates={week.days.filter(d => d.type !== 'rest').map(d => d.date)}
                      onSave={async (fields) => {
                        await onAddDay(phase.name, week.weekNumber, fields);
                        setAddingDayTo(null);
                      }}
                      onCancel={() => setAddingDayTo(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setAddingDayTo({ phaseName: phase.name, weekNumber: week.weekNumber })}
                      className="cursor-pointer mt-1 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                      title="Add a day to this week"
                    >
                      + Add day
                    </button>
                  )
                )}
              </div>
            );
          })}
        </section>
      ))}
    </div>
  );
}
