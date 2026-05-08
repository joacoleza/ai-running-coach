import { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { useNavigate } from 'react-router-dom';
import { updateRun, deleteRun, unlinkRun } from '../../hooks/useRuns';
import type { Run, Exercise } from '../../hooks/useRuns';
import { useChatContext } from '../../contexts/ChatContext';
import { DateInput } from './DateInput';
import { ExerciseList } from './ExerciseList';
import { RunBadge } from './RunBadge';

interface RunDetailModalProps {
  run: Run;
  onClose: () => void;
  onUpdated: (updatedRun: Run) => void;
  onDeleted: (runId: string) => void;
  activePlanId?: string;
}

function isValidDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const d = new Date(dateStr + 'T12:00:00');
  return !isNaN(d.getTime()) && d.getFullYear() >= 2000 && d.getFullYear() <= 2099;
}

function formatRunDate(isoDate: string): string {
  const d = new Date(isoDate + 'T12:00:00');
  const weekday = d.toLocaleDateString('en-GB', { weekday: 'long' });
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${weekday} ${dd}/${mm}/${d.getFullYear()}`;
}

function formatPace(pace: number): string {
  const m = Math.floor(pace);
  const s = Math.round((pace - m) * 60);
  return `${m}:${String(s).padStart(2, '0')}/km`;
}

function computePace(distance: number, duration: string): number | null {
  if (!distance || distance <= 0) return null;
  const parts = duration.split(':').map(Number);
  let totalMinutes = 0;
  if (parts.length === 2) totalMinutes = (parts[0] ?? 0) + (parts[1] ?? 0) / 60;
  else if (parts.length === 3) totalMinutes = (parts[0] ?? 0) * 60 + (parts[1] ?? 0) + (parts[2] ?? 0) / 60;
  if (!totalMinutes || totalMinutes <= 0) return null;
  return totalMinutes / distance;
}

function computeSpeed(distance: number, duration: string): string | null {
  if (!distance || distance <= 0) return null;
  const parts = duration.split(':').map(Number);
  let totalMinutes = 0;
  if (parts.length === 2) totalMinutes = (parts[0] ?? 0) + (parts[1] ?? 0) / 60;
  else if (parts.length === 3) totalMinutes = (parts[0] ?? 0) * 60 + (parts[1] ?? 0) + (parts[2] ?? 0) / 60;
  if (!totalMinutes || totalMinutes <= 0) return null;
  return `${((distance / totalMinutes) * 60).toFixed(1)} km/h`;
}

function openCoachPanel() {
  window.dispatchEvent(new CustomEvent('open-coach-panel'));
}

export function RunDetailModal({ run, onClose, onUpdated, onDeleted, activePlanId }: RunDetailModalProps) {
  const { sendMessage } = useChatContext();
  const navigate = useNavigate();

  const [editDate, setEditDate] = useState(run.date);
  const [editDistance, setEditDistance] = useState(String(run.distance));
  const [editDuration, setEditDuration] = useState(run.duration);
  const [editAvgHR, setEditAvgHR] = useState(run.avgHR !== undefined ? String(run.avgHR) : '');
  const [editNotes, setEditNotes] = useState(run.notes ?? '');

  const [pendingExercises, setPendingExercises] = useState<Exercise[]>(run.exercises ?? []);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isRequestingFeedback, setIsRequestingFeedback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset pendingExercises if run prop changes (e.g. after save)
  useEffect(() => {
    setPendingExercises(run.exercises ?? []);
  }, [run._id]); // eslint-disable-line react-hooks/exhaustive-deps

  const exercisesChanged =
    run.discipline === 'gym' &&
    JSON.stringify(pendingExercises) !== JSON.stringify(run.exercises ?? []);

  const isDirty =
    editDate !== run.date ||
    editDistance !== String(run.distance) ||
    editDuration !== run.duration ||
    editAvgHR !== (run.avgHR !== undefined ? String(run.avgHR) : '') ||
    editNotes !== (run.notes ?? '') ||
    exercisesChanged;

  const editDistNum = parseFloat(editDistance);
  const editPace = computePace(editDistNum, editDuration);
  const isCycle = (run.discipline ?? 'run') === 'cycle';
  const isGym = (run.discipline ?? 'run') === 'gym';
  const editSpeed = isCycle ? computeSpeed(editDistNum, editDuration) : null;

  const handleSave = async () => {
    if (isSaving) return;
    if (!isValidDate(editDate)) {
      setError('Please enter a valid date.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      const updates: Parameters<typeof updateRun>[1] = {};
      if (editDate !== run.date) updates.date = editDate;
      if (editDistNum !== run.distance) updates.distance = editDistNum;
      if (editDuration !== run.duration) updates.duration = editDuration;
      const hrVal = editAvgHR ? parseInt(editAvgHR, 10) : undefined;
      if (hrVal !== run.avgHR) updates.avgHR = hrVal;
      const notesVal = editNotes || undefined;
      if (notesVal !== run.notes) updates.notes = notesVal;
      if (exercisesChanged) updates.exercises = pendingExercises;

      const updated = await updateRun(run._id, updates);
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddFeedback = async () => {
    setIsRequestingFeedback(true);

    const dateStr = formatRunDate(run.date);
    const isGymSession = (run.discipline ?? 'run') === 'gym';
    const isCycleSession = (run.discipline ?? 'run') === 'cycle';
    const hrStr = run.avgHR ? `, avg HR ${run.avgHR}bpm` : '';
    const notesStr = editNotes ? `\nNotes: "${editNotes}"` : '';
    const planStr = run.weekNumber
      ? `\nThis session was for Week ${run.weekNumber} Day ${run.dayLabel} of my training plan.`
      : '\nThis was a standalone session (not linked to my training plan).';

    let message: string;
    if (isGymSession) {
      message =
        `Please give me coaching feedback on my gym session:\n` +
        `Date: ${dateStr}\n` +
        `Type: ${run.type ?? 'General'}\n` +
        `Duration: ${run.duration}\n` +
        `Exercises: ${run.exercises?.length ?? 0} logged${hrStr}${notesStr}${planStr}\n` +
        `Please provide: a brief assessment, one key insight, and any plan adjustments if relevant. Do not emit any plan update commands — only provide text feedback.`;
    } else {
      const distStr = `${run.distance}km`;
      const paceStr = isCycleSession
        ? computeSpeed(run.distance, run.duration) ?? '--'
        : formatPace(run.pace);
      message =
        `Please give me coaching feedback on my ${isCycleSession ? 'cycling session' : 'run'}:\n` +
        `Date: ${dateStr}\nDistance: ${distStr}\n${isCycleSession ? 'Speed' : 'Pace'}: ${paceStr}${hrStr}${notesStr}${planStr}\n` +
        `Please provide: a brief assessment, one key insight, and any plan adjustments if relevant. Do not emit any plan update commands — only provide text feedback.`;
    }

    openCoachPanel();

    try {
      const responseText = await sendMessage(message);
      if (responseText && run._id) {
        try {
          const cleanInsight = responseText.replace(/<[^>]+\/>/g, '').trim();
          const updated = await updateRun(run._id, { insight: cleanInsight });
          onUpdated(updated);
        } catch {
          // Non-fatal: insight save failure doesn't block UI
        }
      }
    } catch {
      // Coach panel will show streaming error
    } finally {
      setIsRequestingFeedback(false);
    }
  };

  const handleUnlink = async () => {
    if (!window.confirm('Unlink this run from the training plan day? The day will be marked incomplete.')) return;
    setIsUnlinking(true);
    setError(null);
    try {
      const updated = await unlinkRun(run._id);
      onUpdated(updated);
      window.dispatchEvent(new Event('plan-updated'));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to unlink run');
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Delete this run? This cannot be undone.')) return;
    setIsDeleting(true);
    setError(null);
    try {
      await deleteRun(run._id);
      onDeleted(run._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete run');
      setIsDeleting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[85dvh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="font-semibold text-gray-900">{formatRunDate(run.date)}</h2>
            <RunBadge discipline={(run.discipline ?? 'run') as 'run' | 'gym' | 'cycle'} />
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Plan link badge — click to navigate to plan and scroll to that day */}
          {run.weekNumber && (
            <div>
              <button
                onClick={() => {
                  onClose();
                  if (run.planId === activePlanId) {
                    navigate('/plan', { state: { scrollToDay: `${run.weekNumber}-${run.dayLabel}` } });
                  } else {
                    navigate(`/archive/${run.planId}`, { state: { scrollToWeek: run.weekNumber } });
                  }
                }}
                className={`text-xs px-2 py-1 rounded-full cursor-pointer transition-colors ${run.planId === activePlanId ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
              >
                Week {run.weekNumber} · Day {run.dayLabel}
              </button>
            </div>
          )}

          {/* Editable fields */}
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {/* Date */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Date</label>
                <DateInput
                  value={editDate}
                  onChange={setEditDate}
                  min="2000-01-01"
                  max="2099-12-31"
                  invalid={!!editDate && !isValidDate(editDate)}
                />
              </div>

              {/* Distance */}
              {!isGym && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Distance</label>
                <div className="relative">
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={editDistance}
                    onChange={(e) => setEditDistance(e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">km</span>
                </div>
              </div>
              )}

              {/* Duration */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Duration</label>
                <input
                  type="text"
                  value={editDuration}
                  onChange={(e) => setEditDuration(e.target.value)}
                  placeholder="45:30"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-0.5">MM:SS or HH:MM:SS</p>
              </div>

              {/* Avg HR */}
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Avg HR <span className="text-gray-400 font-normal">(optional)</span></label>
                <div className="relative">
                  <input
                    type="number"
                    min="50"
                    max="250"
                    value={editAvgHR}
                    onChange={(e) => setEditAvgHR(e.target.value)}
                    placeholder="—"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-gray-500 pointer-events-none">bpm</span>
                </div>
              </div>

              {/* Pace / Speed (read-only, computed) */}
              {!isGym && (
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  {isCycle ? 'Speed (km/h)' : 'Pace'}
                </label>
                <p className="text-sm text-gray-700 px-3 py-2 bg-gray-50 rounded-lg">
                  {isCycle
                    ? (editSpeed ?? computeSpeed(run.distance, run.duration) ?? '--')
                    : (editPace !== null ? formatPace(editPace) : formatPace(run.pace))}
                </p>
              </div>
              )}
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea
                rows={4}
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="How did it feel?"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
          </div>

          {/* Coaching Insight */}
          {run.insight && (
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">Coach Insight</p>
              <div className="text-sm text-gray-700 prose prose-sm max-w-none">
                <ReactMarkdown>{run.insight}</ReactMarkdown>
              </div>
            </div>
          )}

          {/* Exercise log — only for gym sessions */}
          {run.discipline === 'gym' && (
            <section className="pt-3 border-t border-gray-100">
              <h3 className="text-sm font-medium text-gray-700 mb-2">Session Exercises</h3>
              <ExerciseList
                exercises={run.exercises ?? []}
                runId={run._id}
                onExercisesChange={setPendingExercises}
              />
            </section>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          {/* Save button (only when dirty) */}
          {isDirty && (
            <button
              onClick={() => void handleSave()}
              disabled={isSaving}
              className="w-full bg-blue-600 text-white rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {isSaving ? 'Saving...' : 'Save changes'}
            </button>
          )}

          {/* Get coaching feedback button */}
          <button
            onClick={() => void handleAddFeedback()}
            disabled={isRequestingFeedback}
            className="w-full bg-gray-100 text-gray-700 rounded-lg px-4 py-2 text-sm font-medium hover:bg-gray-200 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isRequestingFeedback ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Requesting feedback...
              </>
            ) : (
              'Get coaching feedback'
            )}
          </button>

          {/* Unlink section — only for linked runs */}
          {run.planId && (
            <div className="pt-2 border-t border-gray-100">
              <button
                onClick={() => void handleUnlink()}
                disabled={isUnlinking}
                className="w-full text-amber-600 text-sm hover:text-amber-800 py-1 transition-colors disabled:opacity-50"
              >
                {isUnlinking ? 'Unlinking...' : 'Unlink from plan'}
              </button>
            </div>
          )}

          {/* Delete section */}
          <div className="pt-2 border-t border-gray-100">
            {run.planId ? (
              <span
                title="Undo the training plan day first to delete this run"
                className="block cursor-not-allowed"
              >
                <button
                  disabled
                  className="w-full bg-gray-100 text-gray-400 rounded-lg px-3 py-2 text-sm font-medium pointer-events-none"
                >
                  Delete session
                </button>
              </span>
            ) : (
              <button
                onClick={() => void handleDelete()}
                disabled={isDeleting}
                className="w-full text-red-600 text-sm hover:text-red-800 py-1 transition-colors disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Delete session'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
