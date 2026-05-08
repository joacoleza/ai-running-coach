import { useState } from 'react';
import type { Exercise } from '../../hooks/useRuns';

interface ExerciseFormProps {
  onSave: (exercise: Exercise) => void;
  onCancel: () => void;
}

export function ExerciseForm({ onSave, onCancel }: ExerciseFormProps) {
  const [name, setName] = useState('');
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [unit, setUnit] = useState<'lbs' | 'kg'>('lbs');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const showUnit = !!weight && parseFloat(weight) > 0;
  const setsNum = parseInt(sets, 10);
  const repsNum = parseInt(reps, 10);
  const isValid =
    name.trim().length > 0 &&
    name.trim().length <= 100 &&
    Number.isInteger(setsNum) && setsNum >= 1 && setsNum <= 99 &&
    Number.isInteger(repsNum) && repsNum >= 1 && repsNum <= 99 &&
    (!weight || parseFloat(weight) > 0);

  const handleSave = () => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = 'Exercise name is required';
    else if (name.trim().length > 100) errs.name = 'Exercise name must be 100 characters or fewer';
    if (!Number.isInteger(setsNum) || setsNum < 1 || setsNum > 99) errs.sets = 'Sets must be a whole number between 1 and 99';
    if (!Number.isInteger(repsNum) || repsNum < 1 || repsNum > 99) errs.reps = 'Reps must be a whole number between 1 and 99';
    if (weight && parseFloat(weight) <= 0) errs.weight = 'Weight must be greater than 0';

    if (Object.keys(errs).length > 0) { setErrors(errs); return; }

    const exercise: Exercise = {
      name: name.trim(),
      sets: setsNum,
      reps: repsNum,
    };
    if (weight && parseFloat(weight) > 0) {
      exercise.weight = parseFloat(weight);
      exercise.unit = unit;
    }
    onSave(exercise);
  };

  return (
    <div className="bg-gray-50 rounded-lg p-3 space-y-2 border border-gray-200">
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Exercise Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={100}
          placeholder="e.g. Bench Press"
          className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
        />
        {errors.name && <p className="text-red-600 text-xs mt-0.5">{errors.name}</p>}
      </div>
      <div className="grid grid-cols-3 gap-2">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Sets</label>
          <input
            type="number"
            min="1"
            max="99"
            value={sets}
            onChange={(e) => setSets(e.target.value)}
            placeholder="3"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
          />
          {errors.sets && <p className="text-red-600 text-xs mt-0.5">{errors.sets}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Reps</label>
          <input
            type="number"
            min="1"
            max="99"
            value={reps}
            onChange={(e) => setReps(e.target.value)}
            placeholder="8"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
          />
          {errors.reps && <p className="text-red-600 text-xs mt-0.5">{errors.reps}</p>}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Weight <span className="text-gray-400 font-normal">(optional)</span>
          </label>
          <input
            type="number"
            min="0.5"
            step="0.5"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
            placeholder="185"
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400"
          />
          {errors.weight && <p className="text-red-600 text-xs mt-0.5">{errors.weight}</p>}
        </div>
      </div>
      {showUnit && (
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as 'lbs' | 'kg')}
            className="border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
          >
            <option value="lbs">lbs</option>
            <option value="kg">kg</option>
          </select>
        </div>
      )}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!isValid}
          className="bg-blue-600 text-white text-sm font-medium py-1 px-3 rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Add
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1 text-sm text-gray-600 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
