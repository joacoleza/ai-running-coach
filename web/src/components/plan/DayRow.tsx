import { useState } from 'react';
import type { PlanDay } from '../../hooks/usePlan';

interface DayRowProps {
  day: PlanDay;
  onUpdate: (date: string, updates: Record<string, string>) => Promise<void>;
  onDelete: (date: string) => Promise<void>;
  readonly?: boolean;
}

function formatDayDate(dateStr: string): string {
  // Use noon to avoid timezone-shift issues when parsing date-only strings
  const d = new Date(dateStr + 'T12:00:00');
  const weekday = d.toLocaleDateString('en-CA', { weekday: 'long' });
  return `${weekday} ${dateStr}`;
}

export function DayRow({ day, onUpdate, onDelete, readonly }: DayRowProps) {
  const [editingField, setEditingField] = useState<'guidelines' | 'objective' | null>(null);
  const [editValue, setEditValue] = useState('');
  const [addingRun, setAddingRun] = useState(false);
  const [newRunMinutes, setNewRunMinutes] = useState('');
  const [newRunGuidelines, setNewRunGuidelines] = useState('');

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

  const saveNewRun = async () => {
    if (!newRunMinutes || isNaN(Number(newRunMinutes))) return;
    await onUpdate(day.date, {
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
          <button onClick={() => void saveNewRun()} className="text-blue-600 hover:text-blue-800 text-xs font-medium">Save</button>
          <button onClick={() => { setAddingRun(false); setNewRunMinutes(''); setNewRunGuidelines(''); }} className="text-gray-400 hover:text-gray-600 text-xs">Cancel</button>
        </div>
      );
    }

    return (
      <div className="flex items-center gap-2 py-1 px-2 text-sm text-gray-400 group">
        <span className="font-semibold text-gray-500">{formatDayDate(day.date)}</span>
        <span className="italic">Rest</span>
        {!readonly && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity ml-auto">
            <button
              onClick={() => setAddingRun(true)}
              className="p-1 text-gray-300 hover:text-blue-500 transition-colors text-xs"
              title="Add a run to this day"
            >
              + run
            </button>
            <button
              onClick={() => { void onDelete(day.date); }}
              className="p-1 text-gray-300 hover:text-red-500 transition-colors"
              title="Delete day"
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-start gap-2 py-1 px-2 text-sm rounded group ${day.completed ? 'bg-green-50' : day.skipped ? 'bg-gray-50' : 'hover:bg-gray-50'}`}>
      {/* Status indicator */}
      {day.completed && (
        <span className="text-green-500 mt-0.5 flex-shrink-0" title="Completed">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </span>
      )}

      <div className={`flex-1 ${day.completed || day.skipped ? 'line-through text-gray-400' : ''}`}>
        <span className="font-semibold text-gray-700 mr-2">{formatDayDate(day.date)}</span>

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

      {/* Action buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Undo for completed/skipped */}
        {(day.completed || day.skipped) && !readonly && (
          <button
            onClick={() => { void onUpdate(day.date, { completed: 'false', skipped: 'false' }); }}
            className="p-1 text-gray-300 hover:text-blue-600 transition-colors text-xs opacity-0 group-hover:opacity-100"
            title="Undo"
          >
            Undo
          </button>
        )}

        {/* Complete / Skip — only on active days */}
        {!isReadOnly && (
          <>
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
          </>
        )}

        {/* Delete — always show on hover (unless readonly) */}
        {!readonly && (
          <button
            onClick={() => { void onDelete(day.date); }}
            className="p-1 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
            title="Delete day"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
