import { useState } from 'react';
import type { PlanDay } from '../../hooks/usePlan';

interface DayRowProps {
  day: PlanDay;
  onUpdate: (date: string, updates: Record<string, string>) => Promise<void>;
  readonly?: boolean;
}

export function DayRow({ day, onUpdate, readonly }: DayRowProps) {
  const [editingField, setEditingField] = useState<'guidelines' | 'objective' | null>(null);
  const [editValue, setEditValue] = useState('');

  const isReadOnly = readonly || day.completed || day.skipped;

  const startEdit = (field: 'guidelines' | 'objective') => {
    if (isReadOnly) return;
    setEditingField(field);
    setEditValue(field === 'guidelines' ? day.guidelines : String(day.objective?.value ?? ''));
  };

  const cancelEdit = () => {
    setEditingField(null);
    setEditValue('');
  };

  const saveEdit = async () => {
    if (!editingField) return;
    if (editingField === 'guidelines') {
      await onUpdate(day.date, { guidelines: editValue });
    } else if (editingField === 'objective' && day.objective) {
      await onUpdate(day.date, {
        objective_kind: day.objective.kind,
        objective_value: editValue,
        objective_unit: day.objective.unit,
      });
    }
    setEditingField(null);
    setEditValue('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      void saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  if (day.type === 'rest') {
    return (
      <div className="flex items-center gap-2 py-1 px-2 text-sm text-gray-400">
        <span className="font-semibold text-gray-500">{day.date}</span>
        <span className="italic">Rest</span>
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2 py-1 px-2 text-sm rounded ${day.completed ? 'bg-green-50' : day.skipped ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
      {/* Status indicator */}
      {day.completed && (
        <span className="text-green-500 mt-0.5 flex-shrink-0" title="Completed">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}

      <div className={`flex-1 ${day.completed || day.skipped ? 'line-through text-gray-400' : ''}`}>
        <span className="font-semibold text-gray-700 mr-2">{day.date}</span>

        {/* Objective */}
        {day.objective && (
          <>
            {editingField === 'objective' ? (
              <input
                autoFocus
                type="text"
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                onBlur={() => { void saveEdit(); }}
                onKeyDown={handleKeyDown}
                className="inline-block w-20 border border-blue-400 rounded px-1 text-sm mr-1"
              />
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

        {/* Guidelines */}
        {editingField === 'guidelines' ? (
          <input
            autoFocus
            type="text"
            value={editValue}
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={() => { void saveEdit(); }}
            onKeyDown={handleKeyDown}
            className="inline-block w-64 border border-blue-400 rounded px-1 text-sm"
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
      </div>

      {/* Action buttons — only on non-completed, non-skipped, non-readonly days */}
      {!isReadOnly && (
        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => { void onUpdate(day.date, { completed: 'true' }); }}
            className="p-1 text-gray-400 hover:text-green-600 transition-colors"
            title="Mark as completed"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button
            onClick={() => { void onUpdate(day.date, { skipped: 'true' }); }}
            className="p-1 text-gray-400 hover:text-amber-500 transition-colors text-xs font-medium"
            title="Mark as skipped"
          >
            Skip
          </button>
        </div>
      )}
    </div>
  );
}
