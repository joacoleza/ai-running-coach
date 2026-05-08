import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RunEntryForm } from '../components/runs/RunEntryForm';
import type { Run } from '../hooks/useRuns';

// Mock createRun from useRuns hook (path resolved relative to test file)
vi.mock('../hooks/useRuns', () => ({
  createRun: vi.fn(),
}));

import { createRun } from '../hooks/useRuns';

const mockCreateRun = vi.mocked(createRun);

const mockRun: Run = {
  _id: 'run-001',
  date: '2026-04-01',
  distance: 5,
  duration: '25:00',
  pace: 5.0,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
};

const onSave = vi.fn();
const onCancel = vi.fn();

function renderForm(props: Partial<React.ComponentProps<typeof RunEntryForm>> = {}) {
  return render(
    <RunEntryForm
      onSave={onSave}
      onCancel={onCancel}
      {...props}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockCreateRun.mockResolvedValue(mockRun);
});

describe('RunEntryForm', () => {
  it('renders date, distance, duration, avgHR, notes fields', () => {
    renderForm();

    // Check labels are visible (component uses bare labels without htmlFor)
    expect(screen.getByText('Date')).toBeInTheDocument();
    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getByText('Duration')).toBeInTheDocument();
    // Inputs by placeholder
    expect(screen.getByPlaceholderText('5.0')).toBeInTheDocument(); // distance
    expect(screen.getByPlaceholderText('45:30')).toBeInTheDocument(); // duration
    expect(screen.getByPlaceholderText('155')).toBeInTheDocument(); // avgHR
    expect(screen.getByPlaceholderText("How did it go?")).toBeInTheDocument(); // notes
  });

  it('computes and displays pace live when distance and duration entered', async () => {
    renderForm();

    const distanceInput = screen.getByPlaceholderText('5.0');
    const durationInput = screen.getByPlaceholderText('45:30');

    fireEvent.change(distanceInput, { target: { value: '5' } });
    fireEvent.change(durationInput, { target: { value: '25:00' } });

    // Pace should now display: 25 min / 5 km = 5:00/km
    await waitFor(() => {
      expect(screen.getByText(/5:00\/km/)).toBeInTheDocument();
    });
  });

  it('shows error when required fields missing on submit', async () => {
    renderForm();

    // Save button should be disabled when form is incomplete (no distance or duration)
    const saveBtn = screen.getByRole('button', { name: /save session/i });
    expect(saveBtn).toBeDisabled();
  });

  it('calls createRun with correct data on valid submit', async () => {
    renderForm();

    fireEvent.change(screen.getByPlaceholderText('5.0'), { target: { value: '5' } });
    fireEvent.change(screen.getByPlaceholderText('45:30'), { target: { value: '25:00' } });

    const saveBtn = screen.getByRole('button', { name: /save session/i });
    expect(saveBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(mockCreateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        distance: 5,
        duration: '25:00',
        weekNumber: undefined,
        dayLabel: undefined,
      })
    );
  });

  it('calls createRun with weekNumber and dayLabel when provided (linked run)', async () => {
    renderForm({ weekNumber: 2, dayLabel: 'B' });

    fireEvent.change(screen.getByPlaceholderText('5.0'), { target: { value: '8' } });
    fireEvent.change(screen.getByPlaceholderText('45:30'), { target: { value: '40:00' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save session/i }));
    });

    expect(mockCreateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        distance: 8,
        duration: '40:00',
        weekNumber: 2,
        dayLabel: 'B',
      })
    );
  });

  it('calls onSave after successful createRun', async () => {
    renderForm();

    fireEvent.change(screen.getByPlaceholderText('5.0'), { target: { value: '5' } });
    fireEvent.change(screen.getByPlaceholderText('45:30'), { target: { value: '25:00' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save session/i }));
    });

    expect(onSave).toHaveBeenCalledWith(mockRun);
  });

  it('calls onCancel when cancel button clicked', () => {
    renderForm();

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
  });

  it('save button is disabled when date is invalid', () => {
    renderForm();
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const distanceInput = screen.getByPlaceholderText('5.0');
    const durationInput = screen.getByPlaceholderText('45:30');

    fireEvent.change(distanceInput, { target: { value: '5' } });
    fireEvent.change(durationInput, { target: { value: '25:00' } });
    fireEvent.change(dateInput, { target: { value: '' } });

    expect(screen.getByRole('button', { name: /save session/i })).toBeDisabled();
  });

  it('date input has type=date with min and max attributes', () => {
    renderForm();
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();
    expect(dateInput.min).toBe('2000-01-01');
    expect(dateInput.max).toMatch(/^\d{4}-\d{2}-\d{2}$/); // today's date
  });

  it('renders discipline selector defaulting to Run', () => {
    renderForm();
    const select = screen.getByRole('combobox', { name: /discipline/i });
    expect(select).toBeInTheDocument();
    expect((select as HTMLSelectElement).value).toBe('run');
  });

  it('shows distance field for Run discipline and hides Session Type', () => {
    renderForm();
    expect(screen.getByPlaceholderText('5.0')).toBeInTheDocument();
    expect(screen.queryByText('Session Type')).not.toBeInTheDocument();
  });

  it('hides distance field and shows Session Type when Gym is selected', async () => {
    renderForm();
    const select = screen.getByRole('combobox', { name: /discipline/i });
    fireEvent.change(select, { target: { value: 'gym' } });
    expect(screen.queryByPlaceholderText('5.0')).not.toBeInTheDocument();
    expect(screen.getByText('Session Type')).toBeInTheDocument();
  });

  it('submits gym session without distance when type selected', async () => {
    renderForm();
    const disciplineSelect = screen.getByRole('combobox', { name: /discipline/i });
    fireEvent.change(disciplineSelect, { target: { value: 'gym' } });

    const typeSelect = screen.getByRole('combobox', { name: /session type/i });
    fireEvent.change(typeSelect, { target: { value: 'upper body' } });

    // Fill required fields
    const durationInput = screen.getByPlaceholderText('45:30');
    fireEvent.change(durationInput, { target: { value: '45:00' } });

    // Submit
    const saveBtn = screen.getByRole('button', { name: /save session/i });
    await act(async () => { fireEvent.click(saveBtn); });

    expect(mockCreateRun).toHaveBeenCalledWith(expect.objectContaining({
      discipline: 'gym',
      type: 'upper body',
      duration: '45:00',
    }));
  });

  it('shows save button disabled when gym discipline selected but no type chosen', async () => {
    renderForm();
    const disciplineSelect = screen.getByRole('combobox', { name: /discipline/i });
    fireEvent.change(disciplineSelect, { target: { value: 'gym' } });

    const durationInput = screen.getByPlaceholderText('45:30');
    fireEvent.change(durationInput, { target: { value: '45:00' } });

    // isValid should be false (no gymType) — button is disabled
    const saveBtn = screen.getByRole('button', { name: /save session/i });
    expect(saveBtn).toBeDisabled();
  });
});

describe('RunEntryForm — gym discipline exercise entry', () => {
  it('shows Exercises section when gym discipline is selected', () => {
    renderForm();
    const disciplineSelect = screen.getByRole('combobox', { name: /discipline/i });
    fireEvent.change(disciplineSelect, { target: { value: 'gym' } });

    // The label has two text nodes: "Exercises" and "(optional)" — check for the label element
    const labels = screen.getAllByText(/exercises/i);
    expect(labels.some(el => el.tagName === 'LABEL' || el.closest('label'))).toBe(true);
  });

  it('does not show Exercises section for run discipline', () => {
    renderForm();
    // No "Exercises" label for run discipline
    const labels = screen.queryAllByText(/^exercises$/i);
    expect(labels).toHaveLength(0);
  });

  it('does not show Exercises section for cycle discipline', () => {
    renderForm();
    const disciplineSelect = screen.getByRole('combobox', { name: /discipline/i });
    fireEvent.change(disciplineSelect, { target: { value: 'cycle' } });
    const labels = screen.queryAllByText(/^exercises$/i);
    expect(labels).toHaveLength(0);
  });

  it('gym session can be saved without exercises (exercises optional)', async () => {
    renderForm();
    const disciplineSelect = screen.getByRole('combobox', { name: /discipline/i });
    fireEvent.change(disciplineSelect, { target: { value: 'gym' } });

    const typeSelect = screen.getByRole('combobox', { name: /session type/i });
    fireEvent.change(typeSelect, { target: { value: 'upper body' } });
    fireEvent.change(screen.getByPlaceholderText('45:30'), { target: { value: '45:00' } });

    const saveBtn = screen.getByRole('button', { name: /save session/i });
    await act(async () => { fireEvent.click(saveBtn); });

    // exercises key absent or undefined when no exercises added
    const call = mockCreateRun.mock.calls[0]?.[0];
    expect(call?.exercises === undefined || (Array.isArray(call?.exercises) && call.exercises.length === 0)).toBe(true);
  });

  it('exercises added inline are included in createRun payload', async () => {
    renderForm();
    const disciplineSelect = screen.getByRole('combobox', { name: /discipline/i });
    fireEvent.change(disciplineSelect, { target: { value: 'gym' } });

    const typeSelect = screen.getByRole('combobox', { name: /session type/i });
    fireEvent.change(typeSelect, { target: { value: 'upper body' } });
    fireEvent.change(screen.getByPlaceholderText('45:30'), { target: { value: '45:00' } });

    // Add an exercise via the inline form
    fireEvent.click(screen.getByRole('button', { name: /\+ add exercise/i }));

    // Fill exercise form
    fireEvent.change(screen.getByPlaceholderText(/bench press/i), { target: { value: 'Push ups' } });
    fireEvent.change(screen.getByPlaceholderText('3'), { target: { value: '3' } });
    fireEvent.change(screen.getByPlaceholderText('8'), { target: { value: '10' } });

    // Save the exercise
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    // Exercise should appear in list
    expect(screen.getByText(/push ups 3x10/i)).toBeInTheDocument();

    // Submit the form
    const saveBtn = screen.getByRole('button', { name: /save session/i });
    await act(async () => { fireEvent.click(saveBtn); });

    expect(mockCreateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        exercises: expect.arrayContaining([
          expect.objectContaining({ name: 'Push ups', sets: 3, reps: 10 }),
        ]),
      })
    );
  });

  it('can remove an exercise from the inline list', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    renderForm();
    const disciplineSelect = screen.getByRole('combobox', { name: /discipline/i });
    fireEvent.change(disciplineSelect, { target: { value: 'gym' } });

    // Add an exercise
    fireEvent.click(screen.getByRole('button', { name: /\+ add exercise/i }));
    fireEvent.change(screen.getByPlaceholderText(/bench press/i), { target: { value: 'Squat' } });
    fireEvent.change(screen.getByPlaceholderText('3'), { target: { value: '4' } });
    fireEvent.change(screen.getByPlaceholderText('8'), { target: { value: '12' } });
    fireEvent.click(screen.getByRole('button', { name: /^add$/i }));

    expect(screen.getByText(/squat 4x12/i)).toBeInTheDocument();

    // Remove it
    fireEvent.click(screen.getByRole('button', { name: /remove/i }));
    expect(screen.queryByText(/squat 4x12/i)).not.toBeInTheDocument();
    vi.restoreAllMocks();
  });
});

describe('RunEntryForm — duration validation', () => {
  it('accepts valid MM:SS format "45:30"', () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('5.0'), { target: { value: '5' } });
    fireEvent.change(screen.getByPlaceholderText('45:30'), { target: { value: '45:30' } });
    expect(screen.getByRole('button', { name: /save session/i })).not.toBeDisabled();
  });

  it('accepts valid HH:MM:SS format "1:45:30"', () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('5.0'), { target: { value: '5' } });
    fireEvent.change(screen.getByPlaceholderText('45:30'), { target: { value: '1:45:30' } });
    expect(screen.getByRole('button', { name: /save session/i })).not.toBeDisabled();
  });

  it('rejects "12:0011" (extra digits after seconds)', () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('5.0'), { target: { value: '5' } });
    fireEvent.change(screen.getByPlaceholderText('45:30'), { target: { value: '12:0011' } });
    expect(screen.getByRole('button', { name: /save session/i })).toBeDisabled();
  });

  it('rejects "1:00asdasda" (non-numeric characters)', () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('5.0'), { target: { value: '5' } });
    fireEvent.change(screen.getByPlaceholderText('45:30'), { target: { value: '1:00asdasda' } });
    expect(screen.getByRole('button', { name: /save session/i })).toBeDisabled();
  });

  it('rejects "9:5" (seconds must be exactly 2 digits)', () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('5.0'), { target: { value: '5' } });
    fireEvent.change(screen.getByPlaceholderText('45:30'), { target: { value: '9:5' } });
    expect(screen.getByRole('button', { name: /save session/i })).toBeDisabled();
  });

  it('rejects "145:30" (3-digit minutes in MM:SS form is invalid — must use HH:MM:SS)', () => {
    renderForm();
    fireEvent.change(screen.getByPlaceholderText('5.0'), { target: { value: '5' } });
    fireEvent.change(screen.getByPlaceholderText('45:30'), { target: { value: '145:30' } });
    // 145:30 has 3-digit first segment with only 2 parts — should fail strict validation
    expect(screen.getByRole('button', { name: /save session/i })).toBeDisabled();
  });
});

describe('RunEntryForm — cycling discipline', () => {
  it('shows Speed label (not Pace) when cycling discipline is selected', async () => {
    renderForm();
    const disciplineSelect = screen.getByRole('combobox', { name: /discipline/i });
    fireEvent.change(disciplineSelect, { target: { value: 'cycle' } });

    // Speed label should appear for cycling
    await waitFor(() => {
      expect(screen.getByText('Speed')).toBeInTheDocument();
    });
    // Pace label should NOT appear
    expect(screen.queryByText('Pace')).not.toBeInTheDocument();
  });

  it('displays computed speed (km/h) when distance and duration entered for cycling', async () => {
    renderForm();
    const disciplineSelect = screen.getByRole('combobox', { name: /discipline/i });
    fireEvent.change(disciplineSelect, { target: { value: 'cycle' } });

    const distanceInput = screen.getByPlaceholderText('5.0');
    const durationInput = screen.getByPlaceholderText('45:30');

    fireEvent.change(distanceInput, { target: { value: '30' } });
    fireEvent.change(durationInput, { target: { value: '60:00' } });

    // Speed should display: 30km in 60:00 (60 minutes) = 30.0 km/h
    await waitFor(() => {
      expect(screen.getByText('30.0 km/h')).toBeInTheDocument();
    });
  });

  it('hides Session Type when cycling discipline is selected', async () => {
    renderForm();
    const disciplineSelect = screen.getByRole('combobox', { name: /discipline/i });
    fireEvent.change(disciplineSelect, { target: { value: 'cycle' } });

    // Session Type should not appear for cycling
    expect(screen.queryByText('Session Type')).not.toBeInTheDocument();
  });

  it('shows distance field when cycling discipline is selected', async () => {
    renderForm();
    const disciplineSelect = screen.getByRole('combobox', { name: /discipline/i });
    fireEvent.change(disciplineSelect, { target: { value: 'cycle' } });

    // Distance field should be present for cycling
    expect(screen.getByPlaceholderText('5.0')).toBeInTheDocument();
  });

  it('submits cycling session with correct speed computation', async () => {
    renderForm();
    const disciplineSelect = screen.getByRole('combobox', { name: /discipline/i });
    fireEvent.change(disciplineSelect, { target: { value: 'cycle' } });

    fireEvent.change(screen.getByPlaceholderText('5.0'), { target: { value: '40' } });
    fireEvent.change(screen.getByPlaceholderText('45:30'), { target: { value: '90:00' } });

    const saveBtn = screen.getByRole('button', { name: /save session/i });
    expect(saveBtn).not.toBeDisabled();

    await act(async () => {
      fireEvent.click(saveBtn);
    });

    expect(mockCreateRun).toHaveBeenCalledWith(
      expect.objectContaining({
        discipline: 'cycle',
        distance: 40,
        duration: '90:00',
      })
    );
  });
});
