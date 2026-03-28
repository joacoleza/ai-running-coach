import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DayRow } from '../components/plan/DayRow';
import type { PlanDay } from '../hooks/usePlan';

function makeRunDay(overrides: Partial<PlanDay> = {}): PlanDay {
  return {
    date: '2026-04-07',
    type: 'run',
    objective: { kind: 'distance', value: 5, unit: 'km' },
    guidelines: 'Easy Zone 2 run',
    completed: false,
    skipped: false,
    ...overrides,
  };
}

function makeRestDay(overrides: Partial<PlanDay> = {}): PlanDay {
  return {
    date: '2026-04-08',
    type: 'rest',
    guidelines: 'Rest day',
    completed: false,
    skipped: false,
    ...overrides,
  };
}

const noop = vi.fn().mockResolvedValue(undefined);

describe('DayRow', () => {
  it('renders day date and guidelines', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    // Date is now formatted as "Tuesday 2026-04-07" — match by partial text
    expect(screen.getByText(/2026-04-07/)).toBeInTheDocument();
    expect(screen.getByText('Easy Zone 2 run')).toBeInTheDocument();
  });

  it('clicking objective enters edit mode with number input and unit select', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    const objSpan = screen.getByTitle('Click to edit objective');
    fireEvent.click(objSpan);
    expect(screen.getByDisplayValue('5')).toBeInTheDocument(); // value input
    expect(screen.getByDisplayValue('km')).toBeInTheDocument(); // unit select
  });

  it('editing objective: changing value and unit then blurring saves both', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to edit objective'));
    const valueInput = screen.getByDisplayValue('5');
    const unitSelect = screen.getByDisplayValue('km');
    fireEvent.change(valueInput, { target: { value: '30' } });
    fireEvent.change(unitSelect, { target: { value: 'min' } });
    await act(async () => {
      // blur away from the widget entirely
      fireEvent.blur(valueInput, { relatedTarget: document.body });
    });
    expect(onUpdate).toHaveBeenCalledWith('2026-04-07', {
      objective_kind: 'time',
      objective_value: '30',
      objective_unit: 'min',
    });
  });

  it('editing objective: pressing Enter saves the new value', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to edit objective'));
    const valueInput = screen.getByDisplayValue('5');
    fireEvent.change(valueInput, { target: { value: '10' } });
    await act(async () => {
      fireEvent.keyDown(valueInput, { key: 'Enter' });
    });
    expect(onUpdate).toHaveBeenCalledWith('2026-04-07', {
      objective_kind: 'distance',
      objective_value: '10',
      objective_unit: 'km',
    });
  });

  it('editing objective: switching unit from km to min derives time kind', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to edit objective'));
    const unitSelect = screen.getByDisplayValue('km');
    fireEvent.change(unitSelect, { target: { value: 'min' } });
    const valueInput = screen.getByDisplayValue('5');
    await act(async () => {
      fireEvent.keyDown(valueInput, { key: 'Enter' });
    });
    expect(onUpdate).toHaveBeenCalledWith('2026-04-07', expect.objectContaining({
      objective_kind: 'time',
      objective_unit: 'min',
    }));
  });

  it('clicking guidelines enters edit mode with textarea', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    const guidelinesSpan = screen.getByText('Easy Zone 2 run');
    fireEvent.click(guidelinesSpan);
    const textarea = screen.getByDisplayValue('Easy Zone 2 run');
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('saving edit on blur calls onUpdate with new guidelines', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} onDelete={noop} />);
    const guidelinesSpan = screen.getByText('Easy Zone 2 run');
    fireEvent.click(guidelinesSpan);
    const textarea = screen.getByDisplayValue('Easy Zone 2 run');
    fireEvent.change(textarea, { target: { value: 'Tempo run' } });
    await act(async () => {
      fireEvent.blur(textarea);
    });
    expect(onUpdate).toHaveBeenCalledWith('2026-04-07', { guidelines: 'Tempo run' });
  });

  it('completed day does not show edit controls or action buttons', () => {
    render(<DayRow day={makeRunDay({ completed: true })} onUpdate={noop} onDelete={noop} />);
    // Skip/complete buttons should not be visible
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as skipped')).not.toBeInTheDocument();
    // Delete button must not be visible — completed days are locked history
    expect(screen.queryByTitle('Delete day')).not.toBeInTheDocument();
    // Clicking guidelines should not enter edit mode
    const guidelinesSpan = screen.getByText('Easy Zone 2 run');
    fireEvent.click(guidelinesSpan);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('completed day shows undo button (in DOM; desktop hover-only via parent md:opacity-0)', () => {
    render(<DayRow day={makeRunDay({ completed: true })} onUpdate={noop} onDelete={noop} />);
    const undoBtn = screen.getByTitle('Undo');
    expect(undoBtn).toBeInTheDocument();
    // The button itself has no opacity-0 — opacity is controlled on the parent span via md: class
    expect(undoBtn.className).not.toContain('opacity-0');
  });

  it('skipped day shows undo button', () => {
    render(<DayRow day={makeRunDay({ skipped: true })} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByTitle('Undo')).toBeInTheDocument();
  });

  it('clicking undo on completed day calls onUpdate with completed false and skipped false', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay({ completed: true })} onUpdate={onUpdate} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Undo'));
    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith('2026-04-07', { completed: 'false', skipped: 'false' });
    });
  });

  it('clicking complete button calls onUpdate with completed true', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} onDelete={noop} />);
    const completeBtn = screen.getByTitle('Mark as completed');
    fireEvent.click(completeBtn);
    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith('2026-04-07', { completed: 'true' });
    });
  });

  it('readonly mode hides all action controls', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} readonly={true} />);
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as skipped')).not.toBeInTheDocument();
    // Clicking guidelines should not enter edit mode in readonly
    const guidelinesSpan = screen.getByText('Easy Zone 2 run');
    fireEvent.click(guidelinesSpan);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('date is formatted with day name prefix', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    // 2026-04-07 is a Tuesday
    expect(screen.getByText(/Tuesday 2026-04-07/)).toBeInTheDocument();
  });

  it('delete button is in DOM (desktop hover-only via parent md:opacity-0)', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    const deleteBtn = screen.getByTitle('Delete day');
    expect(deleteBtn).toBeInTheDocument();
    // The button itself has no opacity-0 — opacity is controlled on the parent span via md: class
    expect(deleteBtn.className).not.toContain('opacity-0');
  });

  it('clicking delete shows confirmation prompt, does not immediately call onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete day'));
    expect(screen.getByText('Remove?')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('clicking Yes in confirmation calls onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete day'));
    await act(async () => {
      fireEvent.click(screen.getByText('Yes'));
    });
    expect(onDelete).toHaveBeenCalledWith('2026-04-07');
  });

  it('clicking No in confirmation dismisses without calling onDelete', () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete day'));
    fireEvent.click(screen.getByText('No'));
    expect(screen.queryByText('Remove?')).not.toBeInTheDocument();
    expect(screen.getByTitle('Delete day')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('readonly mode has no delete button', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} readonly={true} />);
    expect(screen.queryByTitle('Delete day')).not.toBeInTheDocument();
  });

  it('clicking date label opens day-of-week picker instead of a date input', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to move to a different date'));
    // Should show Mon–Sun day buttons, NOT a date input
    expect(screen.getByRole('button', { name: /^Mon$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Tue$/i })).toBeInTheDocument();
    expect(screen.queryByDisplayValue('2026-04-07')).not.toBeInTheDocument();
  });

  it('current day button is highlighted in the day picker', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to move to a different date'));
    // 2026-04-07 is a Tuesday — Tue button should have the active (blue) styling
    const tuesdayBtn = screen.getByRole('button', { name: /^Tue$/i });
    expect(tuesdayBtn.className).toContain('bg-blue-600');
  });

  it('clicking a different day in picker calls onUpdate with newDate', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to move to a different date'));
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /^Thu$/i }));
    });
    // Thursday of the same week as 2026-04-07 (Tue) is 2026-04-09
    expect(onUpdate).toHaveBeenCalledWith('2026-04-07', { newDate: '2026-04-09' });
  });

  it('existing dates in same week are disabled in the day picker', () => {
    // Wednesday already has a workout → Wed button should be disabled
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} weekExistingDates={['2026-04-08']} />);
    fireEvent.click(screen.getByTitle('Click to move to a different date'));
    const wedBtn = screen.getByRole('button', { name: /^Wed$/i });
    expect(wedBtn).toBeDisabled();
  });

  it('cancel button closes the day picker without saving', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to move to a different date'));
    expect(screen.getByRole('button', { name: /^Mon$/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByRole('button', { name: /^Mon$/i })).not.toBeInTheDocument();
  });

  it('date label is not clickable on completed days', () => {
    render(<DayRow day={makeRunDay({ completed: true })} onUpdate={noop} onDelete={noop} />);
    expect(screen.queryByTitle('Click to move to a different date')).not.toBeInTheDocument();
  });

  it('action buttons have cursor-pointer class', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByTitle('Mark as completed').className).toContain('cursor-pointer');
    expect(screen.getByTitle('Mark as skipped').className).toContain('cursor-pointer');
    expect(screen.getByTitle('Delete day').className).toContain('cursor-pointer');
  });

  it('undo button on completed day has cursor-pointer', () => {
    render(<DayRow day={makeRunDay({ completed: true })} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByTitle('Undo').className).toContain('cursor-pointer');
  });

  it('date picker buttons have cursor-pointer on available days', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to move to a different date'));
    // Mon is a free slot — should have cursor-pointer
    const monBtn = screen.getByRole('button', { name: /^Mon$/i });
    expect(monBtn.className).toContain('cursor-pointer');
    // Cancel also has cursor-pointer
    expect(screen.getByRole('button', { name: /cancel/i }).className).toContain('cursor-pointer');
  });

  it('shows inline error when onUpdate rejects', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('Day not found'));
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} onDelete={noop} />);
    await act(async () => {
      fireEvent.click(screen.getByTitle('Mark as completed'));
    });
    expect(await screen.findByText('Day not found')).toBeInTheDocument();
  });

  it('shows inline error when onDelete rejects', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('Delete failed'));
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete day'));
    await act(async () => {
      fireEvent.click(screen.getByText('Yes'));
    });
    expect(await screen.findByText('Delete failed')).toBeInTheDocument();
  });
});

describe('DayRow — saving state', () => {
  it('shows saving spinner while update is in flight', async () => {
    let resolveUpdate!: () => void;
    const onUpdate = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveUpdate = resolve; })
    );
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} onDelete={noop} />);
    // Trigger an update — do not await so it stays pending
    fireEvent.click(screen.getByTitle('Mark as completed'));
    // Saving spinner should be visible
    expect(await screen.findByLabelText('Saving')).toBeInTheDocument();
    // Action buttons should be hidden while saving
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Delete day')).not.toBeInTheDocument();
    // Resolve the update
    await act(async () => { resolveUpdate(); });
    // Spinner gone, action buttons back (day prop unchanged — parent controls updates)
    expect(screen.queryByLabelText('Saving')).not.toBeInTheDocument();
    expect(screen.getByTitle('Mark as completed')).toBeInTheDocument();
  });

  it('clears saving state after update resolves', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} onDelete={noop} />);
    await act(async () => {
      fireEvent.click(screen.getByTitle('Mark as completed'));
    });
    expect(screen.queryByLabelText('Saving')).not.toBeInTheDocument();
  });

  it('clears saving state after update rejects', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('fail'));
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} onDelete={noop} />);
    await act(async () => {
      fireEvent.click(screen.getByTitle('Mark as completed'));
    });
    expect(screen.queryByLabelText('Saving')).not.toBeInTheDocument();
    expect(screen.getByText('fail')).toBeInTheDocument();
  });
});

describe('DayRow — hide actions while editing', () => {
  it('action buttons are hidden while editing guidelines', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    fireEvent.click(screen.getByText('Easy Zone 2 run'));
    expect(screen.queryByTitle('Delete day')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as skipped')).not.toBeInTheDocument();
  });

  it('action buttons are hidden while editing objective', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to edit objective'));
    expect(screen.queryByTitle('Delete day')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as skipped')).not.toBeInTheDocument();
  });

  it('action buttons are hidden while moving date', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to move to a different date'));
    expect(screen.queryByTitle('Delete day')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as skipped')).not.toBeInTheDocument();
  });

  it('action buttons reappear after cancelling date move', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to move to a different date'));
    expect(screen.queryByTitle('Delete day')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.getByTitle('Delete day')).toBeInTheDocument();
  });

  it('starting an edit clears any pending delete confirmation', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    // Open confirmation
    fireEvent.click(screen.getByTitle('Delete day'));
    expect(screen.getByText('Remove?')).toBeInTheDocument();
    // Start editing — confirmation should clear
    fireEvent.click(screen.getByTitle('Click to move to a different date'));
    // Cancel editing to check confirmation is gone
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(screen.queryByText('Remove?')).not.toBeInTheDocument();
    expect(screen.getByTitle('Delete day')).toBeInTheDocument();
  });
});

describe('DayRow — rest day cursor', () => {
  it('+ run and delete buttons on rest day have cursor-pointer', () => {
    render(<DayRow day={makeRestDay()} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByTitle('Add a run to this day').className).toContain('cursor-pointer');
    expect(screen.getByTitle('Delete day').className).toContain('cursor-pointer');
  });

  it('save and cancel buttons in add-run form have cursor-pointer', () => {
    render(<DayRow day={makeRestDay()} onUpdate={noop} onDelete={noop} />);
    fireEvent.click(screen.getByText('+ run'));
    expect(screen.getByText('Save').className).toContain('cursor-pointer');
    expect(screen.getByText('Cancel').className).toContain('cursor-pointer');
  });
});

describe('DayRow — rest day', () => {
  it('renders rest day with formatted date and Rest label', () => {
    render(<DayRow day={makeRestDay()} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByText(/2026-04-08/)).toBeInTheDocument();
    expect(screen.getByText('Rest')).toBeInTheDocument();
  });

  it('rest day has + run button when not readonly', () => {
    render(<DayRow day={makeRestDay()} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByText('+ run')).toBeInTheDocument();
  });

  it('rest day has no + run button in readonly mode', () => {
    render(<DayRow day={makeRestDay()} onUpdate={noop} onDelete={noop} readonly={true} />);
    expect(screen.queryByText('+ run')).not.toBeInTheDocument();
  });

  it('clicking + run opens inline form', () => {
    render(<DayRow day={makeRestDay()} onUpdate={noop} onDelete={noop} />);
    fireEvent.click(screen.getByText('+ run'));
    expect(screen.getByPlaceholderText('min')).toBeInTheDocument();
  });

  it('saving add-run form calls onUpdate with type run and objective', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRestDay()} onUpdate={onUpdate} onDelete={noop} />);
    fireEvent.click(screen.getByText('+ run'));
    fireEvent.change(screen.getByPlaceholderText('min'), { target: { value: '30' } });
    await act(async () => {
      fireEvent.click(screen.getByText('Save'));
    });
    expect(onUpdate).toHaveBeenCalledWith('2026-04-08', expect.objectContaining({
      type: 'run',
      objective_kind: 'time',
      objective_value: '30',
      objective_unit: 'min',
    }));
  });

  it('cancelling add-run form hides the form', () => {
    render(<DayRow day={makeRestDay()} onUpdate={noop} onDelete={noop} />);
    fireEvent.click(screen.getByText('+ run'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(screen.queryByPlaceholderText('min')).not.toBeInTheDocument();
  });

  it('clicking rest day delete shows confirmation, does not immediately call onDelete', () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRestDay()} onUpdate={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete day'));
    expect(screen.getByText('Remove?')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('delete button calls onDelete with the day date after confirming Yes', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRestDay()} onUpdate={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete day'));
    await act(async () => {
      fireEvent.click(screen.getByText('Yes'));
    });
    expect(onDelete).toHaveBeenCalledWith('2026-04-08');
  });

  it('clicking No on rest day confirmation dismisses without deleting', () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRestDay()} onUpdate={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete day'));
    fireEvent.click(screen.getByText('No'));
    expect(screen.queryByText('Remove?')).not.toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
