import type { Exercise } from '../../hooks/usePlan';

interface ExerciseChecklistItemProps {
  exercise: Exercise;
  index: number;
  onToggle: (idx: number, completed: boolean) => void;
}

function formatExerciseSummary(ex: Exercise): string {
  const weight = ex.weight ? ` @ ${ex.weight}${ex.unit ?? ''}` : '';
  return `${ex.sets}x${ex.reps}${weight}`;
}

export function ExerciseChecklistItem({ exercise, index, onToggle }: ExerciseChecklistItemProps) {
  const isDone = !!exercise.completed;

  return (
    <label className="flex items-center gap-2 min-h-[44px] py-1 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={isDone}
        onChange={() => onToggle(index, !isDone)}
        className="w-4 h-4 rounded border-gray-300 text-blue-600 cursor-pointer flex-shrink-0"
      />
      <span className={`text-sm flex-grow ${isDone ? 'line-through text-gray-400' : 'text-gray-800'}`}>
        {exercise.name}
      </span>
      <span className={`text-xs flex-shrink-0 ${isDone ? 'text-gray-300' : 'text-gray-500'}`}>
        {formatExerciseSummary(exercise)}
      </span>
    </label>
  );
}
