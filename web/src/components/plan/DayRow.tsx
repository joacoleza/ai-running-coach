import { useState } from 'react';
import type { PlanDay } from '../../hooks/usePlan';

interface DayRowProps {
  day: PlanDay;
  onUpdate: (date: string, updates: Record<string, string>) => Promise<void>;
  onDelete: (date: string) => Promise<void>;
  readonly?: boolean;
  /** Dates of other (non-rest) workouts in the same week — used to disable taken days in the move-date picker */
  weekExistingDates?: string[];
}

function formatDayDate(dateStr: string): string {
  // Use noon to avoid timezone-shift issues when parsing date-only strings
  const d = new Date(dateStr + 'T12:00:00');
  const weekday = d.toLocaleDateString('en-CA', { weekday: 'long' });
  return `${weekday} ${dateStr}`;
}

/** Returns Mon–Sun dates for the calendar week containing dateStr */
function getWeekDays(dateStr: string): { date: string; label: string }[] {
  const d = new Date(dateStr + 'T12:00:00');
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

export function DayRow({ day, onUpdate, onDelete, readonly, weekExistingDates }: DayRowProps) {
  const [editingField, setEditingField] = useState<'guidelines' | 'objective' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editUnit, setEditUnit] = useState<'km' | 'min'>('km');
  const [addingRun, setAddingRun] = useState(false);
  const [newRunMinutes, setNewRunMinutes] = useState('');
  const [newRunGuidelines, setNewRunGuidelines] = useState('');
  const [movingDate, setMovingDate] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReadOnly = readonly || day.completed || day.skipped;
  const isEditing = editingField !== null || movingDate;

  // Shared error-catching wrappers
  const update = async (updates: Record<string, string>) => {
    setError(null);
    try {
      await onUpdate(day.date, updates);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    }
  };

  const remove = async () => {
    setError(null);
    try {
      await onDelete(day.date);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed');
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

  const startMoveDate = () => {
    if (isReadOnly) return;
    setConfirmingDelete(false);
    setMovingDate(true);
  };

  const moveToDate = async (newDate: string) => {
    setMovingDate(false);
    if (newDate !== day.date) {
      await update({ newDate });
    }
  };

  const saveNewRun = async () => {
    if (!newRunMinutes || isNaN(Number(newRunMinutes))) return;
    await update({
      type: 'run',
      objective_kind: 'time',
      objective_value: newRunMinutes,
      objective_unit: 'min',
      guidelines: newRunGuidelines,
    });
    setAddingRun(false);
    setNewRunMinutes('');
    setNewRunGuidelines('');
  };

  if (day.type === 'rest') {
    if (addingRun) {
      return (
        <div className="flex items-center gap-2 py-1 px-2 text-sm bg-blue-50 rounded">
          <span className="font-semibold text-gray-500 mr-1">{formatDayDate(day.date)}</span>
          <input
            autoFocus
            type="number"
            placeholder="min"
            value={newRunMinutes}
            onChange={(e) => setNewRunMinutes(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void saveNewRun(); if (e.key === 'Escape') { setAddingRun(false); setNewRunMinutes(''); setNewRunGuidelines(''); } }}
            className="w-16 border border-blue-400 rounded px-1 text-sm"
          />
          <span className="text-gray-400 text-xs">min</span>
          <input
            type="text"
            placeholder="guidelines (optional)"
            value={newRunGuidelines}
            onChange={(e) => setNewRunGuidelines(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void saveNewRun(); if (e.key === 'Escape') { setAddingRun(false); setNewRunMinutes(''); setNewRunGuidelines(''); } }}
            className="flex-1 border border-blue-400 rounded px-1 text-sm"
          />
          <button onClick={() => void saveNewRun()} className="cursor-pointer text-blue-600 hover:text-blue-800 text-xs font-medium">Save</button>
          <button onClick={() => { setAddingRun(false); setNewRunMinutes(''); setNewRunGuidelines(''); }} className="cursor-pointer text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 py-1 px-2 text-sm text-gray-400 group">
        <span className="font-semibold text-gray-500">{formatDayDate(day.date)}</span>
        <span className="italic">Rest</span>
        {!readonly && (
          <div className={`flex items-center gap-1 ml-auto ${confirmingDelete ? '' : 'opacity-0 group-hover:opacity-100 transition-opacity'}`}>
            {!confirmingDelete && (
              <button
                onClick={() => setAddingRun(true)}
                className="cursor-pointer p-1 text-gray-300 hover:text-blue-500 transition-colors text-xs"
                title="Add a run to this day"
              >
                + run
              </button>
            )}
            {confirmingDelete ? (
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
                className="cursor-pointer p-1 text-gray-300 hover:text-red-500 transition-colors"
                title="Delete day"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`group flex items-start gap-2 py-1 px-2 text-sm rounded ${day.completed ? 'bg-green-50' : day.skipped ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
      {/* Status indicator */}
      {day.completed && (
        <span className="text-green-500 mt-0.5 flex-shrink-0" title="Completed">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}

      <div className={`flex-1 min-w-0 ${day.completed || day.skipped ? 'line-through text-gray-400' : ''}`}>
        {/* Date — click to open day-of-week picker (only on active days) */}
        {movingDate ? (
          <span className="inline-flex flex-wrap items-center gap-1 mr-2">
            {getWeekDays(day.date).map(({ date, label }) => {
              const taken = (weekExistingDates ?? []).includes(date);
              const isCurrent = date === day.date;
              return (
                <button
                  key={date}
                  disabled={taken && !isCurrent}
                  onClick={() => { void moveToDate(date); }}
                  title={date}
                  className={`px-2 py-0.5 rounded text-xs font-medium transition-colors ${
                    isCurrent
                      ? 'cursor-pointer bg-blue-600 text-white'
                      : taken
                      ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                      : 'cursor-pointer bg-white border border-blue-300 text-blue-700 hover:bg-blue-50'
                  }`}
                >
                  {label}
                </button>
              );
            })}
            <button
              onClick={() => setMovingDate(false)}
              className="cursor-pointer text-xs text-gray-400 hover:text-gray-600 ml-1"
            >
              Cancel
            </button>
          </span>
        ) : (
          <span
            className={`font-semibold text-gray-700 mr-1 ${!isReadOnly ? 'cursor-pointer hover:bg-blue-50 rounded px-0.5' : ''}`}
            onClick={startMoveDate}
            title={!isReadOnly ? 'Click to move to a different date' : undefined}
          >
            {formatDayDate(day.date)}
          </span>
        )}

        {/* Objective — edit value and unit together */}
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

        {/* Guidelines — textarea for comfortable editing */}
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

        {/* Action buttons — hidden while editing; confirm-state always visible, otherwise hover-only on desktop */}
        {!isEditing && (
          <span className={`inline-flex items-center gap-1 ml-2 align-middle no-underline ${confirmingDelete ? '' : 'md:opacity-0 md:group-hover:opacity-100 md:transition-opacity'}`}>
            {/* Undo for completed/skipped */}
            {(day.completed || day.skipped) && !readonly && !confirmingDelete && (
              <button
                onClick={() => { void update({ completed: 'false', skipped: 'false' }); }}
                className="cursor-pointer p-1 text-gray-400 hover:text-blue-600 transition-colors text-xs"
                title="Undo"
              >
                Undo
              </button>
            )}

            {/* Complete / Skip — only on active days */}
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
                  onClick={() => { void update({ skipped: 'true' }); }}
                  className="cursor-pointer p-1 text-gray-400 hover:text-amber-500 transition-colors text-xs font-medium"
                  title="Mark as skipped"
                >
                  Skip
                </button>
              </>
            )}

            {/* Delete / Confirmation */}
            {!readonly && (
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
  );
}
