import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExerciseChecklistItem } from '../components/plan/ExerciseChecklistItem';
import type { Exercise } from '../hooks/usePlan';

const onToggle = vi.fn();

const baseExercise: Exercise = {
  name: 'Bench Press',
  sets: 3,
  reps: 8,
  weight: 185,
  unit: 'lbs',
  completed: false,
};

beforeEach(() => vi.clearAllMocks());

describe('ExerciseChecklistItem', () => {
  it('renders exercise name and sets/reps/weight', () => {
    render(<ExerciseChecklistItem exercise={baseExercise} index={0} onToggle={onToggle} />);
    expect(screen.getByText('Bench Press')).toBeInTheDocument();
    expect(screen.getByText('3x8 @ 185lbs')).toBeInTheDocument();
  });

  it('renders unchecked checkbox when completed=false', () => {
    render(<ExerciseChecklistItem exercise={baseExercise} index={0} onToggle={onToggle} />);
    const checkbox = screen.getByRole('checkbox');
    expect(checkbox).not.toBeChecked();
  });

  it('renders checked checkbox when completed=true', () => {
    render(<ExerciseChecklistItem exercise={{ ...baseExercise, completed: true }} index={0} onToggle={onToggle} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('calls onToggle with index and new completed state when checkbox clicked', () => {
    render(<ExerciseChecklistItem exercise={baseExercise} index={2} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith(2, true); // was false, toggling to true
  });

  it('calls onToggle with false when unchecking a completed exercise', () => {
    render(<ExerciseChecklistItem exercise={{ ...baseExercise, completed: true }} index={1} onToggle={onToggle} />);
    fireEvent.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith(1, false);
  });

  it('renders without weight/unit for body-weight exercise', () => {
    const bodyWeightEx: Exercise = { name: 'Pull-ups', sets: 3, reps: 10 };
    render(<ExerciseChecklistItem exercise={bodyWeightEx} index={0} onToggle={onToggle} />);
    expect(screen.getByText('Pull-ups')).toBeInTheDocument();
    expect(screen.getByText('3x10')).toBeInTheDocument();
  });

  it('applies line-through style when completed', () => {
    const { container } = render(
      <ExerciseChecklistItem exercise={{ ...baseExercise, completed: true }} index={0} onToggle={onToggle} />
    );
    const nameSpan = container.querySelector('span.line-through');
    expect(nameSpan).not.toBeNull();
    expect(nameSpan?.textContent).toBe('Bench Press');
  });
});
