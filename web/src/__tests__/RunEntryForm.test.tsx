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
