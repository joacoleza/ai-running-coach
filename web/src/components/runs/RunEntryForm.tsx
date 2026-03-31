import { useState } from 'react';
import { createRun } from '../../hooks/useRuns';
import type { Run } from '../../hooks/useRuns';

interface RunEntryFormProps {
  weekNumber?: number;    // if provided, run will be linked to plan day on save
  dayLabel?: string;      // if provided, run will be linked to plan day on save
  dayGuidelines?: string; // shown as "Target: X" hint when completing a plan day
  onSave: (run: Run) => void;
  onCancel: () => void;
}

const todayLocal = (() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
})();

function computePaceDisplay(distStr: string, durStr: string): string {
  const dist = parseFloat(distStr);
  if (!dist || dist <= 0) return '';
  // Parse duration: support MM:SS and HH:MM:SS
  const parts = durStr.split(':').map(Number);
  let totalMinutes = 0;
  if (parts.length === 2) totalMinutes = (parts[0] ?? 0) + (parts[1] ?? 0) / 60;
  else if (parts.length === 3) totalMinutes = (parts[0] ?? 0) * 60 + (parts[1] ?? 0) + (parts[2] ?? 0) / 60;
  if (!totalMinutes || totalMinutes <= 0) return '';
  const paceMin = totalMinutes / dist;
  const m = Math.floor(paceMin);
  const s = Math.round((paceMin - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

export function RunEntryForm({ weekNumber, dayLabel, dayGuidelines, onSave, onCancel }: RunEntryFormProps) {
  const [date, setDate] = useState(todayLocal);
  const [distance, setDistance] = useState('');
  const [duration, setDuration] = useState('');
  const [avgHR, setAvgHR] = useState('');
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pace = computePaceDisplay(distance, duration);

  const handleSubmit = async () => {
    if (isSaving) return;
    const dist = parseFloat(distance);
    if (!date || !dist || dist <= 0 || !duration.match(/^\d{1,2}:\d{2}(:\d{2})?$/)) {
      setError('Please fill in date, distance, and duration (MM:SS).');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const run = await createRun({
        date,
        distance: dist,
        duration,
        avgHR: avgHR ? parseInt(avgHR, 10) : undefined,
        notes: notes || undefined,
        weekNumber,
        dayLabel,
      });
      onSave(run);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save run');
      setIsSaving(false);
    }
  };

  const isValid = !!date && !!parseFloat(distance) && parseFloat(distance) > 0 && !!duration.match(/^\d{1,2}:\d{2}(:\d{2})?$/);

  return (
    <div className="space-y-3">
      {dayGuidelines && (
        <p className="text-xs text-gray-500">
          <span className="font-medium">Target:</span> {dayGuidelines}
        </p>
      )}

      <div className="grid grid-cols-2 gap-3">
        {/* Date */}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Date</label>
          <input
            type="date"
            value={date}
            max={todayLocal}
            onChange={(e) => setDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
          />
        </div>

        {/* Distance */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Distance</label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="0.1"
              step="0.1"
              value={distance}
              onChange={(e) => setDistance(e.target.value)}
              placeholder="5.0"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
            <span className="text-xs text-gray-500 whitespace-nowrap">km</span>
          </div>
        </div>

        {/* Duration */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Duration</label>
          <input
            type="text"
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
            placeholder="45:30"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
          />
          <p className="text-xs text-gray-400 mt-0.5">MM:SS or HH:MM:SS</p>
        </div>

        {/* Pace (computed, read-only) */}
        {pace && (
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Pace</label>
            <div className="px-2 py-1.5 bg-gray-50 border border-gray-200 rounded text-sm text-gray-600">
              {pace}
            </div>
          </div>
        )}

        {/* Avg HR (optional) */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Avg HR <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <div className="flex items-center gap-1">
            <input
              type="number"
              min="50"
              max="250"
              value={avgHR}
              onChange={(e) => setAvgHR(e.target.value)}
              placeholder="155"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
            />
            <span className="text-xs text-gray-500">bpm</span>
          </div>
        </div>
      </div>

      {/* Notes (optional) */}
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Notes <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="How did it go?"
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 resize-none"
        />
      </div>

      {error && <p className="text-red-500 text-xs">{error}</p>}

      <div className="flex gap-2">
        <button
          onClick={() => { void handleSubmit(); }}
          disabled={isSaving || !isValid}
          className="flex-1 bg-green-600 text-white text-sm font-medium py-1.5 px-3 rounded hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Saving…' : 'Save run'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
