import { useState } from 'react';
import type { PlanDay } from '../../hooks/usePlan';
import type { Run } from '../../hooks/useRuns';
import { RunEntryForm } from '../runs/RunEntryForm';

interface DayRowProps {
  day: PlanDay;
  weekNumber: number;
  onUpdate: (weekNumber: number, label: string, updates: Record<string, string>) => Promise<void>;
  onDelete: (weekNumber: number, label: string) => Promise<void>;
  readonly?: boolean;
  linkedRun?: Run | null;     // run linked to this day (fetched by parent PlanView)
  onRunLinked?: () => void;   // called after linking a run — parent refreshes plan
}

function formatRunDate(isoDate: string): string {
  // Format as "Monday 03/04/2026" (day-of-week + DD/MM/YYYY)
  const d = new Date(isoDate + 'T12:00:00');
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${weekday} ${dd}/${mm}/${yyyy}`;
}

export function DayRow({ day, weekNumber, onUpdate, onDelete, readonly, linkedRun, onRunLinked }: DayRowProps) {
  const [editingField, setEditingField] = useState<'guidelines' | 'objective' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editUnit, setEditUnit] = useState<'km' | 'min'>('km');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [completingRun, setCompletingRun] = useState(false);

  const isReadOnly = readonly || day.completed || day.skipped;
  const isEditing = editingField !== null;

  // Shared error-catching wrappers
  const update = async (updates: Record<string, string>) => {
    setError(null);
    setIsSaving(true);
    try {
      await onUpdate(weekNumber, day.label, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async () => {
    setError(null);
    setIsSaving(true);
    try {
      await onDelete(weekNumber, day.label);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
      setIsSaving(false);
    }
  };

  const startEdit = (field: 'guidelines' | 'objective') => {
    if (isReadOnly) return;
    setConfirmingDelete(false);
    setEditingField(field);
    if (field === 'guidelines') {
      setEditValue(day.guidelines);
    } else {
      setEditValue(String(day.objective?.value ?? ''));
      setEditUnit((day.objective?.unit === 'min' ? 'min' : 'km') as 'km' | 'min');
    }
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingField) return;
    if (editingField === 'guidelines') {
      await update({ guidelines: editValue });
    } else if (editingField === 'objective' && day.objective) {
      await update({
        objective_kind: editUnit === 'min' ? 'time' : 'distance',
        objective_value: editValue,
        objective_unit: editUnit,
      });
    }
    setEditingField(null);
    setEditValue('');
  };

  return (
    <>
      {/* Log run modal — same appearance as Runs page */}
      {completingRun && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setCompletingRun(false)}
        >
          <div
            className="bg-white rounded-xl shadow-xl w-full max-w-md p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-semibold text-gray-900 mb-3">Log a run</h2>
            <RunEntryForm
              weekNumber={weekNumber}
              dayLabel={day.label}
              dayGuidelines={day.guidelines}
              onSave={() => {
                setCompletingRun(false);
                window.dispatchEvent(new Event('plan-updated'));
              }}
              onCancel={() => setCompletingRun(false)}
            />
          </div>
        </div>
      )}

      <div className={`group flex items-start gap-2 py-1 px-2 text-sm rounded ${day.completed ? 'bg-green-50' : day.skipped ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
        {/* Status indicator */}
        {day.completed && (
          <span className="text-green-500 mt-0.5 flex-shrink-0" title="Completed">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </span>
        )}

        <div className="flex-1 min-w-0">
          {/* Strikethrough section — day label, objective, guidelines */}
          <span className={day.completed || day.skipped ? 'line-through text-gray-400' : ''}>
            <span className="font-semibold text-gray-700 mr-1">
              Day {day.label}
            </span>

            {day.objective && (
              <>
                {editingField === 'objective' ? (
                  <span
                    className="inline-flex items-center gap-1 mr-1"
                    onBlur={(e) => {
                      if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                        void saveEdit();
                      }
                    }}
                  >
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') void saveEdit(); else if (e.key === 'Escape') cancelEdit(); }}
                      className="w-16 border border-blue-400 rounded px-1 text-sm"
                    />
                    <select
                      value={editUnit}
                      onChange={(e) => setEditUnit(e.target.value as 'km' | 'min')}
                      className="border border-blue-400 rounded px-1 text-sm"
                    >
                      <option value="km">km</option>
                      <option value="min">min</option>
                    </select>
                  </span>
                ) : (
                  <span
                    className={`mr-1 ${!isReadOnly ? 'cursor-pointer hover:bg-blue-50 hover:text-blue-700 rounded px-0.5' : ''}`}
                    onClick={() => startEdit('objective')}
                    title={!isReadOnly ? 'Click to edit objective' : undefined}
                  >
                    {day.objective.value} {day.objective.unit}
                  </span>
                )}
                {day.guidelines && <span className="text-gray-400 mr-1">--</span>}
              </>
            )}

            {editingField === 'guidelines' ? (
              <textarea
                autoFocus
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => { void saveEdit(); }}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') cancelEdit();
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void saveEdit(); }
                }}
                rows={2}
                className="block w-full border border-blue-400 rounded px-2 py-1 text-sm mt-1 resize-none"
              />
            ) : (
              <span
                className={`text-gray-600 ${!isReadOnly ? 'cursor-pointer hover:bg-blue-50 hover:text-blue-700 rounded px-0.5' : ''}`}
                onClick={() => startEdit('guidelines')}
                title={!isReadOnly ? 'Click to edit guidelines' : undefined}
              >
                {day.guidelines || <span className="text-gray-300 italic">No guidelines</span>}
              </span>
            )}

            {day.skipped && <span className="ml-1 text-xs text-gray-400">(skipped)</span>}
          </span>

          {/* Undo — inline with guidelines, always next to the text */}
          {!isEditing && !isSaving && (day.completed || day.skipped) && !readonly && !confirmingDelete && (
            <button
              onClick={() => { void update({ completed: 'false', skipped: 'false' }); }}
              className="cursor-pointer p-1 text-gray-400 hover:text-blue-600 transition-colors text-xs ml-1 align-middle md:opacity-0 md:group-hover:opacity-100 md:transition-opacity"
              title="Undo"
            >
              Undo
            </button>
          )}

          {/* Run date — separate from strikethrough, renders below on its own line */}
          {day.completed && linkedRun && (
            <button
              onClick={() => window.dispatchEvent(new CustomEvent('open-run-detail', { detail: { runId: linkedRun._id } }))}
              className="block text-xs text-green-600 mt-0.5 hover:underline cursor-pointer"
            >
              {formatRunDate(linkedRun.date)}
            </button>
          )}

          {/* Saving indicator */}
          {isSaving && (
            <span className="inline-flex items-center gap-1 ml-2 align-middle text-xs text-gray-400" aria-label="Saving">
              <svg className="h-3.5 w-3.5 animate-spin flex-shrink-0" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
              Saving…
            </span>
          )}

          {/* Action buttons (excluding Undo which is rendered above) */}
          {!isEditing && !isSaving && (
            <span className={`inline-flex items-center gap-1 ml-2 align-middle no-underline ${confirmingDelete ? '' : 'md:opacity-0 md:group-hover:opacity-100 md:transition-opacity'}`}>
              {/* Undo removed from here — rendered inline above */}

              {day.completed && !linkedRun && !readonly && !confirmingDelete && (
                <button
                  onClick={() => setCompletingRun(true)}
                  className="text-xs text-gray-500 hover:text-green-600 cursor-pointer"
                  title="Log run data for this completed day"
                >
                  Log run
                </button>
              )}

              {!isReadOnly && !confirmingDelete && (
                <>
                  <button
                    onClick={() => { void update({ completed: 'true' }); }}
                    className="cursor-pointer p-1 text-gray-400 hover:text-green-600 transition-colors"
                    title="Mark as completed"
                  >
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setCompletingRun(true)}
                    className="text-xs text-gray-500 hover:text-green-600 cursor-pointer"
                    title="Log run data"
                  >
                    Log run
                  </button>
                  <button
                    onClick={() => { void update({ skipped: 'true' }); }}
                    className="cursor-pointer p-1 text-gray-400 hover:text-amber-500 transition-colors text-xs font-medium"
                    title="Mark as skipped"
                  >
                    Skip
                  </button>
                </>
              )}

              {!confirmingDelete && onRunLinked && (
                <button
                  onClick={() => onRunLinked()}
                  className="text-xs text-blue-600 hover:text-blue-800 underline cursor-pointer"
                >
                  Link run
                </button>
              )}

              {!readonly && !day.completed && (
                confirmingDelete ? (
                  <>
                    <span className="text-xs text-gray-500">Remove?</span>
                    <button
                      onClick={() => { setConfirmingDelete(false); void remove(); }}
                      className="cursor-pointer p-1 text-red-500 hover:text-red-700 text-xs font-medium"
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(false)}
                      className="cursor-pointer p-1 text-gray-400 hover:text-gray-600 text-xs"
                    >
                      No
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(true)}
                    className="cursor-pointer p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Delete day"
                  >
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )
              )}
            </span>
          )}

          {error && <div className="text-red-500 text-xs mt-0.5">{error}</div>}
        </div>
      </div>
    </>
  );
}
