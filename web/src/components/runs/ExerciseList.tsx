import { useState } from 'react';
import { updateRun } from '../../hooks/useRuns';
import type { Run, Exercise } from '../../hooks/useRuns';
import { ExerciseForm } from './ExerciseForm';

interface ExerciseListProps {
  exercises: Exercise[];
  runId: string;
  onUpdate: (updated: Run) => void;
}

function formatExercise(ex: Exercise): string {
  const weight = ex.weight ? ` @ ${ex.weight}${ex.unit ?? ''}` : '';
  return `${ex.name} ${ex.sets}x${ex.reps}${weight}`;
}

export function ExerciseList({ exercises, runId, onUpdate }: ExerciseListProps) {
  const [localExercises, setLocalExercises] = useState<Exercise[]>(exercises);
  const [showForm, setShowForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const atLimit = localExercises.length >= 20;
  const nearLimit = localExercises.length >= 15;

  const handleAddExercise = (ex: Exercise) => {
    setLocalExercises(prev => [...prev, ex]);
    setShowForm(false);
  };

  const handleRemove = (idx: number) => {
    if (!window.confirm('Remove Exercise: This will remove the exercise from the logged session.')) return;
    setLocalExercises(prev => prev.filter((_, i) => i !== idx));
  };

  const handleDone = async () => {
    if (isSaving) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      const updated = await updateRun(runId, { exercises: localExercises });
      onUpdate(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save exercises');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      {localExercises.length === 0 && !showForm && (
        <p className="text-sm text-gray-400 italic">No exercises logged yet.</p>
      )}

      {localExercises.map((ex, idx) => (
        <div key={idx} className="flex items-center justify-between py-1 border-b border-gray-100">
          <span className="text-sm text-gray-800">{formatExercise(ex)}</span>
          <button
            onClick={() => handleRemove(idx)}
            className="text-xs text-red-600 hover:text-red-800 cursor-pointer ml-2"
          >
            Remove
          </button>
        </div>
      ))}

      {nearLimit && !atLimit && (
        <p className="text-xs text-amber-600">Adding more than 15 exercises per session is not recommended.</p>
      )}

      {showForm ? (
        <ExerciseForm onSave={handleAddExercise} onCancel={() => setShowForm(false)} />
      ) : (
        !atLimit && (
          <button
            onClick={() => setShowForm(true)}
            className="text-sm text-blue-600 hover:text-blue-800 cursor-pointer"
          >
            + Add Exercise
          </button>
        )
      )}

      {saveError && <p className="text-red-600 text-xs">{saveError}</p>}

      <div className="mt-4 pt-3 border-t border-gray-100">
        <button
          onClick={() => { void handleDone(); }}
          disabled={isSaving}
          className="bg-blue-600 text-white text-sm font-medium py-1 px-3 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isSaving ? 'Saving…' : 'Save exercises'}
        </button>
      </div>
    </div>
  );
}
