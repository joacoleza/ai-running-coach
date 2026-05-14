import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExerciseList } from '../components/runs/ExerciseList';
import type { Exercise } from '../hooks/useRuns';

const noop = vi.fn();
const baseExercise: Exercise = { name: 'Squat', sets: 3, reps: 10 };

beforeEach(() => vi.clearAllMocks());

describe('ExerciseList — empty state', () => {
  it('shows "No exercises logged yet." when list is empty and form is hidden', () => {
    render(<ExerciseList exercises={[]} runId="run-1" onExercisesChange={noop} />);
    expect(screen.getByText(/no exercises logged yet/i)).toBeInTheDocument();
  });

  it('shows "+ Add Exercise" button when list is empty and not at limit', () => {
    render(<ExerciseList exercises={[]} runId="run-1" onExercisesChange={noop} />);
    expect(screen.getByRole('button', { name: /\+ add exercise/i })).toBeInTheDocument();
  });
});

describe('ExerciseList — rendering exercises', () => {
  it('renders each exercise in name SxR format', () => {
    const exercises: Exercise[] = [
      { name: 'Bench Press', sets: 3, reps: 8 },
      { name: 'Pull-ups', sets: 4, reps: 10 },
    ];
    render(<ExerciseList exercises={exercises} runId="run-1" onExercisesChange={noop} />);
    expect(screen.getByText('Bench Press 3x8')).toBeInTheDocument();
    expect(screen.getByText('Pull-ups 4x10')).toBeInTheDocument();
  });

  it('renders exercise with weight and unit in format "Name SxR @ Wunit"', () => {
    const exercises: Exercise[] = [
      { name: 'Deadlift', sets: 5, reps: 5, weight: 100, unit: 'kg' },
    ];
    render(<ExerciseList exercises={exercises} runId="run-1" onExercisesChange={noop} />);
    expect(screen.getByText('Deadlift 5x5 @ 100kg')).toBeInTheDocument();
  });

  it('renders Remove button for each exercise', () => {
    const exercises: Exercise[] = [baseExercise, { name: 'Lunge', sets: 3, reps: 12 }];
    render(<ExerciseList exercises={exercises} runId="run-1" onExercisesChange={noop} />);
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    expect(removeButtons).toHaveLength(2);
  });
});

describe('ExerciseList — remove with confirm', () => {
  it('shows window.confirm when Remove is clicked', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<ExerciseList exercises={[baseExercise]} runId="run-1" onExercisesChange={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(window.confirm).toHaveBeenCalledWith(
      'Remove Exercise: This will remove the exercise from the logged session.'
    );
    vi.restoreAllMocks();
  });

  it('removes exercise from list when confirm returns true', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const onChange = vi.fn();
    const exercises: Exercise[] = [baseExercise, { name: 'Lunge', sets: 3, reps: 12 }];
    render(<ExerciseList exercises={exercises} runId="run-1" onExercisesChange={onChange} />);
    fireEvent.click(screen.getAllByRole('button', { name: /remove/i })[0]);
    // onChange called with updated list (Squat removed)
    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1] as [Exercise[]];
    expect(lastCall[0]).toHaveLength(1);
    expect(lastCall[0][0].name).toBe('Lunge');
    vi.restoreAllMocks();
  });

  it('does not remove exercise when confirm returns false', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const onChange = vi.fn();
    render(<ExerciseList exercises={[baseExercise]} runId="run-1" onExercisesChange={onChange} />);
    const callCountBefore = onChange.mock.calls.length;
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    // onChange call count should not have increased after the initial mount call
    expect(onChange.mock.calls.length).toBe(callCountBefore);
    vi.restoreAllMocks();
  });
});

describe('ExerciseList — limit enforcement', () => {
  it('shows warning text when 15 exercises are logged', () => {
    const exercises: Exercise[] = Array.from({ length: 15 }, (_, i) => ({
      name: `Exercise ${i + 1}`,
      sets: 3,
      reps: 10,
    }));
    render(<ExerciseList exercises={exercises} runId="run-1" onExercisesChange={noop} />);
    expect(screen.getByText(/adding more than 15 exercises/i)).toBeInTheDocument();
  });

  it('hides "+ Add Exercise" button when 20 exercises are logged', () => {
    const exercises: Exercise[] = Array.from({ length: 20 }, (_, i) => ({
      name: `Exercise ${i + 1}`,
      sets: 3,
      reps: 10,
    }));
    render(<ExerciseList exercises={exercises} runId="run-1" onExercisesChange={noop} />);
    expect(screen.queryByRole('button', { name: /\+ add exercise/i })).not.toBeInTheDocument();
  });

  it('shows "+ Add Exercise" button when exactly 19 exercises are logged', () => {
    const exercises: Exercise[] = Array.from({ length: 19 }, (_, i) => ({
      name: `Exercise ${i + 1}`,
      sets: 3,
      reps: 10,
    }));
    render(<ExerciseList exercises={exercises} runId="run-1" onExercisesChange={noop} />);
    expect(screen.getByRole('button', { name: /\+ add exercise/i })).toBeInTheDocument();
  });
});

describe('ExerciseList — add exercise flow', () => {
  it('shows ExerciseForm when "+ Add Exercise" is clicked', () => {
    render(<ExerciseList exercises={[]} runId="run-1" onExercisesChange={noop} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ add exercise/i }));
    // ExerciseForm renders Cancel button
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onExercisesChange with new exercise after saving via ExerciseForm', () => {
    const onChange = vi.fn();
    render(<ExerciseList exercises={[]} runId="run-1" onExercisesChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: /\+ add exercise/i }));

    // Fill in ExerciseForm fields
    fireEvent.change(screen.getByPlaceholderText('e.g. Bench Press'), { target: { value: 'Deadlift' } });
    fireEvent.change(screen.getByPlaceholderText('3'), { target: { value: '3' } });
    fireEvent.change(screen.getByPlaceholderText('8'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    const lastCall = onChange.mock.calls[onChange.mock.calls.length - 1] as [Exercise[]];
    expect(lastCall[0]).toContainEqual(expect.objectContaining({ name: 'Deadlift', sets: 3, reps: 5 }));
  });

  it('no standalone "Save exercises" button exists (removed in Phase 15.1)', () => {
    render(<ExerciseList exercises={[baseExercise]} runId="run-1" onExercisesChange={noop} />);
    expect(screen.queryByRole('button', { name: /save exercises/i })).not.toBeInTheDocument();
  });
});

describe('ExerciseList — onExercisesChange called on mount', () => {
  it('calls onExercisesChange with initial exercises on mount', () => {
    const onChange = vi.fn();
    render(<ExerciseList exercises={[baseExercise]} runId="run-1" onExercisesChange={onChange} />);
    expect(onChange).toHaveBeenCalledWith([baseExercise]);
  });
});
