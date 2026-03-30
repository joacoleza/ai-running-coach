import { useState } from 'react';
import type { PlanDay } from '../../hooks/usePlan';

interface DayRowProps {
  day: PlanDay;
  weekNumber: number;
  onUpdate: (weekNumber: number, label: string, updates: Record<string, string>) => Promise<void>;
  onDelete: (weekNumber: number, label: string) => Promise<void>;
  readonly?: boolean;
}

export function DayRow({ day, weekNumber, onUpdate, onDelete, readonly }: DayRowProps) {
  const [editingField, setEditingField] = useState<'guidelines' | 'objective' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [editUnit, setEditUnit] = useState<'km' | 'min'>('km');
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
        {/* Day label — static display */}
        <span className="font-semibold text-gray-700 mr-1">
          Day {day.label}
        </span>

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

        {/* Action buttons — hidden while editing or saving; confirm-state always visible, otherwise hover-only on desktop */}
        {!isEditing && !isSaving && (
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

            {/* Delete / Confirmation — hidden for completed days (history must not be erased) */}
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
  );
}
