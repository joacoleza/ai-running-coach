import React, { useState } from 'react';
import type { PlanData } from '../../hooks/usePlan';
import type { Run } from '../../hooks/useRuns';
import { DayRow } from './DayRow';
import { PhaseHeader } from './PhaseHeader';
import { LinkRunModal } from '../runs/LinkRunModal';

const ALL_LABELS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'] as const;

interface AddDayFormProps {
  weekNumber: number;
  existingLabels: string[];
  onSave: (fields: Record<string, string>) => Promise<void>;
  onCancel: () => void;
}

function AddDayForm({ existingLabels, onSave, onCancel }: AddDayFormProps) {
  const [selectedLabel, setSelectedLabel] = useState('');
  const [objectiveValue, setObjectiveValue] = useState('');
  const [objectiveUnit, setObjectiveUnit] = useState<'km' | 'min'>('km');
  const [guidelines, setGuidelines] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const hasValidObjective = objectiveValue.trim() !== '' && !isNaN(Number(objectiveValue)) && Number(objectiveValue) > 0;

  const handleSave = async () => {
    if (!selectedLabel || !hasValidObjective || isSaving) return;
    const fields: Record<string, string> = {
      label: selectedLabel,
      type: 'run',
      guidelines,
      objective_kind: objectiveUnit === 'min' ? 'time' : 'distance',
      objective_value: objectiveValue,
      objective_unit: objectiveUnit,
    };
    setIsSaving(true);
    setSaveError(null);
    try {
      await onSave(fields);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to add day');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2 py-1 px-2 text-sm bg-blue-50 rounded mt-1">
      {/* Label selector — A through G, disabled for labels already taken by non-rest days */}
      <div className="flex gap-1">
        {ALL_LABELS.map((label) => {
          const taken = existingLabels.includes(label);
          const selected = selectedLabel === label;
          return (
            <button
              key={label}
              disabled={taken}
              onClick={() => setSelectedLabel(label)}
              className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                taken
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : selected
                  ? 'cursor-pointer bg-blue-600 text-white'
                  : 'cursor-pointer bg-white border border-blue-300 text-blue-700 hover:bg-blue-50'
              }`}
              title={taken ? `Day ${label} already has a workout` : `Day ${label}`}
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
        disabled={!selectedLabel || !hasValidObjective || isSaving}
        className="cursor-pointer text-blue-600 hover:text-blue-800 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-1"
      >
        {isSaving && (
          <svg className="h-3 w-3 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
          </svg>
        )}
        {isSaving ? 'Adding…' : 'Add'}
      </button>
      <button
        onClick={onCancel}
        disabled={isSaving}
        className="cursor-pointer text-gray-400 hover:text-gray-600 text-xs disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Cancel
      </button>
      {saveError && <span className="text-red-500 text-xs w-full">{saveError}</span>}
    </div>
  );
}

interface PlanViewProps {
  plan: PlanData;
  linkedRuns: Map<string, Run>;
  onUpdateDay: (weekNumber: number, label: string, updates: Record<string, string>) => Promise<void>;
  onDeleteDay: (weekNumber: number, label: string) => Promise<void>;
  onAddDay?: (phaseName: string, weekNumber: number, fields: Record<string, string>) => Promise<void>;
  onUpdatePhase?: (phaseIndex: number, updates: { name?: string; description?: string }) => Promise<void>;
  onDeletePhase?: () => Promise<void>;
  onAddPhase?: () => Promise<void>;
  onAddWeek?: (phaseIndex: number) => Promise<void>;
  readonly?: boolean;
  lastCompletedDayRef?: React.RefObject<HTMLDivElement | null>;
  dayRefsMap?: React.RefObject<Map<string, HTMLDivElement>>;
}

export function PlanView({ plan, linkedRuns, onUpdateDay, onDeleteDay, onAddDay, onUpdatePhase, onDeletePhase, onAddPhase, onAddWeek, readonly, lastCompletedDayRef, dayRefsMap }: PlanViewProps) {
  const [addingDayTo, setAddingDayTo] = useState<{ phaseName: string; weekNumber: number } | null>(null);
  const [linkingDay, setLinkingDay] = useState<{ weekNumber: number; label: string; guidelines: string } | null>(null);

  // Compute the key of the last completed non-rest day across all phases/weeks
  const lastCompletedKey = (() => {
    let key = '';
    for (const phase of plan.phases) {
      for (const week of phase.weeks) {
        for (const day of week.days) {
          if (day.completed && day.type !== 'rest') {
            key = `${week.weekNumber}-${day.label}`;
          }
        }
      }
    }
    return key;
  })();

  return (
    <>
      <div>
        {plan.phases.map((phase, idx) => (
          <section key={idx} className="mb-8">
            <PhaseHeader
              phase={phase}
              phaseIndex={idx}
              isLastPhase={idx === plan.phases.length - 1}
              totalPhases={plan.phases.length}
              onUpdatePhase={onUpdatePhase ?? (async () => {})}
              onDeletePhase={onDeletePhase}
              readonly={readonly || !onUpdatePhase}
            />
            {phase.weeks.map(week => {
              // Filter out rest days and sort by label alphabetically
              const activeDays = week.days
                .filter(d => d.type !== 'rest')
                .slice()
                .sort((a, b) => (a.label ?? '').localeCompare(b.label ?? ''));

              const isAddingHere =
                addingDayTo?.phaseName === phase.name &&
                addingDayTo?.weekNumber === week.weekNumber;

              // Show "+ Add day" if there's at least one label slot available (fewer than 7 non-rest days)
              const takenLabels = activeDays.map(d => d.label);
              const hasAvailableLabel = takenLabels.length < 7;

              return (
                <div key={week.weekNumber} className="mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 mb-2">Week {week.weekNumber}</h3>
                  <div className="space-y-1">
                    {activeDays.map(day => {
                      const dayKey = `${week.weekNumber}-${day.label}`;
                      const isLastCompleted = dayKey === lastCompletedKey;
                      return (
                        <div
                          key={day.label}
                          ref={(el) => {
                            if (el) {
                              if (isLastCompleted && lastCompletedDayRef) {
                                (lastCompletedDayRef as React.MutableRefObject<HTMLDivElement | null>).current = el;
                              }
                              dayRefsMap?.current?.set(dayKey, el);
                            } else {
                              dayRefsMap?.current?.delete(dayKey);
                            }
                          }}
                        >
                          <DayRow
                            day={day}
                            weekNumber={week.weekNumber}
                            onUpdate={onUpdateDay}
                            onDelete={onDeleteDay}
                            readonly={readonly}
                            linkedRun={linkedRuns.get(dayKey) ?? null}
                            onRunLinked={
                              !readonly && !day.skipped && (!day.completed || (day.completed && !linkedRuns.get(dayKey)))
                                ? () => setLinkingDay({ weekNumber: week.weekNumber, label: day.label, guidelines: day.guidelines })
                                : undefined
                            }
                          />
                        </div>
                      );
                    })}
                  </div>
                  {!readonly && onAddDay && hasAvailableLabel && (
                    isAddingHere ? (
                      <AddDayForm
                        weekNumber={week.weekNumber}
                        existingLabels={takenLabels}
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
            {!readonly && onAddWeek && (
              <button
                onClick={() => void onAddWeek(idx)}
                className="cursor-pointer mt-2 text-xs text-gray-400 hover:text-blue-600 transition-colors"
                title="Add a week to this phase"
              >
                + Add week
              </button>
            )}
          </section>
        ))}
        {!readonly && onAddPhase && (
          <button
            onClick={() => void onAddPhase()}
            className="cursor-pointer mt-4 text-sm text-gray-400 hover:text-blue-600 transition-colors"
          >
            + Add phase
          </button>
        )}
      </div>

      {/* Link Run Modal */}
      {linkingDay && (
        <LinkRunModal
          weekNumber={linkingDay.weekNumber}
          dayLabel={linkingDay.label}
          dayGuidelines={linkingDay.guidelines}
          onLinked={() => {
            setLinkingDay(null);
            // Dispatch plan-updated so usePlan refreshes (which re-fetches linkedRuns)
            window.dispatchEvent(new Event('plan-updated'));
          }}
          onClose={() => setLinkingDay(null)}
        />
      )}
    </>
  );
}
