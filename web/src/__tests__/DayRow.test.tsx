import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DayRow } from '../components/plan/DayRow';
import type { PlanDay } from '../hooks/usePlan';

function makeRunDay(overrides: Partial<PlanDay> = {}): PlanDay {
  return {
    label: 'A',
    type: 'run',
    objective: { kind: 'distance', value: 5, unit: 'km' },
    guidelines: 'Easy Zone 2 run',
    completed: false,
    skipped: false,
    ...overrides,
  };
}

const noop = vi.fn().mockResolvedValue(undefined);
const defaultWeekNumber = 1;

describe('DayRow', () => {
  it('renders day label and guidelines', () => {
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByText(/Day A/)).toBeInTheDocument();
    expect(screen.getByText('Easy Zone 2 run')).toBeInTheDocument();
  });

  it('clicking objective enters edit mode with number input and unit select', () => {
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
    const objSpan = screen.getByTitle('Click to edit objective');
    fireEvent.click(objSpan);
    expect(screen.getByDisplayValue('5')).toBeInTheDocument(); // value input
    expect(screen.getByDisplayValue('km')).toBeInTheDocument(); // unit select
  });

  it('editing objective: changing value and unit then blurring saves both', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={onUpdate} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to edit objective'));
    const valueInput = screen.getByDisplayValue('5');
    const unitSelect = screen.getByDisplayValue('km');
    fireEvent.change(valueInput, { target: { value: '30' } });
    fireEvent.change(unitSelect, { target: { value: 'min' } });
    await act(async () => {
      // blur away from the widget entirely
      fireEvent.blur(valueInput, { relatedTarget: document.body });
    });
    expect(onUpdate).toHaveBeenCalledWith(1, 'A', {
      objective_kind: 'time',
      objective_value: '30',
      objective_unit: 'min',
    });
  });

  it('editing objective: pressing Enter saves the new value', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={onUpdate} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to edit objective'));
    const valueInput = screen.getByDisplayValue('5');
    fireEvent.change(valueInput, { target: { value: '10' } });
    await act(async () => {
      fireEvent.keyDown(valueInput, { key: 'Enter' });
    });
    expect(onUpdate).toHaveBeenCalledWith(1, 'A', {
      objective_kind: 'distance',
      objective_value: '10',
      objective_unit: 'km',
    });
  });

  it('editing objective: switching unit from km to min derives time kind', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={onUpdate} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to edit objective'));
    const unitSelect = screen.getByDisplayValue('km');
    fireEvent.change(unitSelect, { target: { value: 'min' } });
    const valueInput = screen.getByDisplayValue('5');
    await act(async () => {
      fireEvent.keyDown(valueInput, { key: 'Enter' });
    });
    expect(onUpdate).toHaveBeenCalledWith(1, 'A', expect.objectContaining({
      objective_kind: 'time',
      objective_unit: 'min',
    }));
  });

  it('clicking guidelines enters edit mode with textarea', () => {
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
    const guidelinesSpan = screen.getByText('Easy Zone 2 run');
    fireEvent.click(guidelinesSpan);
    const textarea = screen.getByDisplayValue('Easy Zone 2 run');
    expect(textarea.tagName).toBe('TEXTAREA');
  });

  it('saving edit on blur calls onUpdate with new guidelines', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={onUpdate} onDelete={noop} />);
    const guidelinesSpan = screen.getByText('Easy Zone 2 run');
    fireEvent.click(guidelinesSpan);
    const textarea = screen.getByDisplayValue('Easy Zone 2 run');
    fireEvent.change(textarea, { target: { value: 'Tempo run' } });
    await act(async () => {
      fireEvent.blur(textarea);
    });
    expect(onUpdate).toHaveBeenCalledWith(1, 'A', { guidelines: 'Tempo run' });
  });

  it('completed day does not show edit controls or action buttons', () => {
    render(<DayRow day={makeRunDay({ completed: true })} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
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
    render(<DayRow day={makeRunDay({ completed: true })} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
    const undoBtn = screen.getByTitle('Undo');
    expect(undoBtn).toBeInTheDocument();
    // The button itself has no opacity-0 — opacity is controlled on the parent span via md: class
    expect(undoBtn.className).not.toContain('opacity-0');
  });

  it('skipped day shows undo button', () => {
    render(<DayRow day={makeRunDay({ skipped: true })} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByTitle('Undo')).toBeInTheDocument();
  });

  it('clicking undo on completed day calls onUpdate with completed false and skipped false', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay({ completed: true })} weekNumber={defaultWeekNumber} onUpdate={onUpdate} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Undo'));
    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith(1, 'A', { completed: 'false', skipped: 'false' });
    });
  });

  it('clicking complete button opens RunEntryForm instead of directly marking complete', async () => {
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
    const completeBtn = screen.getByTitle('Mark as completed');
    fireEvent.click(completeBtn);
    // RunEntryForm should be shown — look for the Save run button
    expect(await screen.findByText('Save run')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('readonly mode hides all action controls', () => {
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} readonly={true} />);
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as skipped')).not.toBeInTheDocument();
    // Clicking guidelines should not enter edit mode in readonly
    const guidelinesSpan = screen.getByText('Easy Zone 2 run');
    fireEvent.click(guidelinesSpan);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('day label is shown as "Day A"', () => {
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByText(/Day A/)).toBeInTheDocument();
  });

  it('delete button is in DOM (desktop hover-only via parent md:opacity-0)', () => {
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
    const deleteBtn = screen.getByTitle('Delete day');
    expect(deleteBtn).toBeInTheDocument();
    // The button itself has no opacity-0 — opacity is controlled on the parent span via md: class
    expect(deleteBtn.className).not.toContain('opacity-0');
  });

  it('clicking delete shows confirmation prompt, does not immediately call onDelete', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete day'));
    expect(screen.getByText('Remove?')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
    expect(screen.getByText('No')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('clicking Yes in confirmation calls onDelete with weekNumber and label', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete day'));
    await act(async () => {
      fireEvent.click(screen.getByText('Yes'));
    });
    expect(onDelete).toHaveBeenCalledWith(1, 'A');
  });

  it('clicking No in confirmation dismisses without calling onDelete', () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete day'));
    fireEvent.click(screen.getByText('No'));
    expect(screen.queryByText('Remove?')).not.toBeInTheDocument();
    expect(screen.getByTitle('Delete day')).toBeInTheDocument();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it('readonly mode has no delete button', () => {
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} readonly={true} />);
    expect(screen.queryByTitle('Delete day')).not.toBeInTheDocument();
  });

  it('action buttons have cursor-pointer class', () => {
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByTitle('Mark as completed').className).toContain('cursor-pointer');
    expect(screen.getByTitle('Mark as skipped').className).toContain('cursor-pointer');
    expect(screen.getByTitle('Delete day').className).toContain('cursor-pointer');
  });

  it('undo button on completed day has cursor-pointer', () => {
    render(<DayRow day={makeRunDay({ completed: true })} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
    expect(screen.getByTitle('Undo').className).toContain('cursor-pointer');
  });

  it('shows inline error when onUpdate rejects (skip path)', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('Day not found'));
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={onUpdate} onDelete={noop} />);
    await act(async () => {
      fireEvent.click(screen.getByTitle('Mark as skipped'));
    });
    expect(await screen.findByText('Day not found')).toBeInTheDocument();
  });

  it('shows inline error when onDelete rejects', async () => {
    const onDelete = vi.fn().mockRejectedValue(new Error('Delete failed'));
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete day'));
    await act(async () => {
      fireEvent.click(screen.getByText('Yes'));
    });
    expect(await screen.findByText('Delete failed')).toBeInTheDocument();
  });
});

describe('DayRow — saving state', () => {
  it('shows saving spinner while update is in flight (skip path)', async () => {
    let resolveUpdate!: () => void;
    const onUpdate = vi.fn().mockImplementation(
      () => new Promise<void>((resolve) => { resolveUpdate = resolve; })
    );
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={onUpdate} onDelete={noop} />);
    // Trigger a skip update — do not await so it stays pending
    fireEvent.click(screen.getByTitle('Mark as skipped'));
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

  it('clears saving state after update resolves (skip path)', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={onUpdate} onDelete={noop} />);
    await act(async () => {
      fireEvent.click(screen.getByTitle('Mark as skipped'));
    });
    expect(screen.queryByLabelText('Saving')).not.toBeInTheDocument();
  });

  it('clears saving state after update rejects (skip path)', async () => {
    const onUpdate = vi.fn().mockRejectedValue(new Error('fail'));
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={onUpdate} onDelete={noop} />);
    await act(async () => {
      fireEvent.click(screen.getByTitle('Mark as skipped'));
    });
    expect(screen.queryByLabelText('Saving')).not.toBeInTheDocument();
    expect(screen.getByText('fail')).toBeInTheDocument();
  });
});

describe('DayRow — hide actions while editing', () => {
  it('action buttons are hidden while editing guidelines', () => {
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
    fireEvent.click(screen.getByText('Easy Zone 2 run'));
    expect(screen.queryByTitle('Delete day')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as skipped')).not.toBeInTheDocument();
  });

  it('action buttons are hidden while editing objective', () => {
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
    fireEvent.click(screen.getByTitle('Click to edit objective'));
    expect(screen.queryByTitle('Delete day')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as skipped')).not.toBeInTheDocument();
  });

  it('starting an edit clears any pending delete confirmation', () => {
    render(<DayRow day={makeRunDay()} weekNumber={defaultWeekNumber} onUpdate={noop} onDelete={noop} />);
    // Open confirmation
    fireEvent.click(screen.getByTitle('Delete day'));
    expect(screen.getByText('Remove?')).toBeInTheDocument();
    // Start editing guidelines — confirmation should clear
    fireEvent.click(screen.getByText('Easy Zone 2 run'));
    // Cancel editing
    fireEvent.blur(screen.getByDisplayValue('Easy Zone 2 run'));
  });
});
