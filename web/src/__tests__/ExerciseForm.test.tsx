import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ExerciseForm } from '../components/runs/ExerciseForm';

const onSave = vi.fn();
const onCancel = vi.fn();

beforeEach(() => vi.clearAllMocks());

describe('ExerciseForm', () => {
  it('renders name, sets, reps, weight fields', () => {
    render(<ExerciseForm onSave={onSave} onCancel={onCancel} />);
    expect(screen.getByText('Exercise Name')).toBeInTheDocument();
    expect(screen.getByText('Sets')).toBeInTheDocument();
    expect(screen.getByText('Reps')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('e.g. Bench Press')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('3')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('8')).toBeInTheDocument();
  });

  it('Save Exercise button is disabled when fields empty', () => {
    render(<ExerciseForm onSave={onSave} onCancel={onCancel} />);
    expect(screen.getByRole('button', { name: /save exercise/i })).toBeDisabled();
  });

  it('Save Exercise button enabled when name, sets, reps filled', () => {
    render(<ExerciseForm onSave={onSave} onCancel={onCancel} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Bench Press'), { target: { value: 'Squat' } });
    fireEvent.change(screen.getByPlaceholderText('3'), { target: { value: '3' } });
    fireEvent.change(screen.getByPlaceholderText('8'), { target: { value: '8' } });
    expect(screen.getByRole('button', { name: /save exercise/i })).not.toBeDisabled();
  });

  it('calls onSave with correct Exercise object when submitted', () => {
    render(<ExerciseForm onSave={onSave} onCancel={onCancel} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Bench Press'), { target: { value: 'Bench Press' } });
    fireEvent.change(screen.getByPlaceholderText('3'), { target: { value: '3' } });
    fireEvent.change(screen.getByPlaceholderText('8'), { target: { value: '8' } });
    fireEvent.change(screen.getByPlaceholderText('185'), { target: { value: '185' } });
    // Unit select appears after weight entered
    const unitSelect = screen.getByRole('combobox');
    fireEvent.change(unitSelect, { target: { value: 'lbs' } });
    fireEvent.click(screen.getByRole('button', { name: /save exercise/i }));
    expect(onSave).toHaveBeenCalledWith({
      name: 'Bench Press',
      sets: 3,
      reps: 8,
      weight: 185,
      unit: 'lbs',
    });
  });

  it('calls onSave without weight/unit for body-weight exercise', () => {
    render(<ExerciseForm onSave={onSave} onCancel={onCancel} />);
    fireEvent.change(screen.getByPlaceholderText('e.g. Bench Press'), { target: { value: 'Pull-ups' } });
    fireEvent.change(screen.getByPlaceholderText('3'), { target: { value: '3' } });
    fireEvent.change(screen.getByPlaceholderText('8'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /save exercise/i }));
    expect(onSave).toHaveBeenCalledWith({ name: 'Pull-ups', sets: 3, reps: 10 });
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('weight');
  });

  it('calls onCancel when Cancel clicked', () => {
    render(<ExerciseForm onSave={onSave} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows unit select only when weight is provided', () => {
    render(<ExerciseForm onSave={onSave} onCancel={onCancel} />);
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText('185'), { target: { value: '100' } });
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });
});
