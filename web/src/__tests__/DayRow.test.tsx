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

  it('clicking guidelines enters edit mode with input', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} />);
    const guidelinesSpan = screen.getByText('Easy Zone 2 run');
    fireEvent.click(guidelinesSpan);
    const input = screen.getByDisplayValue('Easy Zone 2 run');
    expect(input.tagName).toBe('INPUT');
  });

  it('saving edit on blur calls onUpdate with new guidelines', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} onDelete={noop} />);
    const guidelinesSpan = screen.getByText('Easy Zone 2 run');
    fireEvent.click(guidelinesSpan);
    const input = screen.getByDisplayValue('Easy Zone 2 run');
    fireEvent.change(input, { target: { value: 'Tempo run' } });
    await act(async () => {
      fireEvent.blur(input);
    });
    expect(onUpdate).toHaveBeenCalledWith('2026-04-07', { guidelines: 'Tempo run' });
  });

  it('completed day does not show edit controls or action buttons', () => {
    render(<DayRow day={makeRunDay({ completed: true })} onUpdate={noop} onDelete={noop} />);
    // Skip/complete buttons should not be visible
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as skipped')).not.toBeInTheDocument();
    // Clicking guidelines should not enter edit mode
    const guidelinesSpan = screen.getByText('Easy Zone 2 run');
    fireEvent.click(guidelinesSpan);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('completed day shows undo button', () => {
    render(<DayRow day={makeRunDay({ completed: true })} onUpdate={noop} onDelete={noop} />);
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

  it('delete button calls onDelete with the day date', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete day'));
    await vi.waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('2026-04-07');
    });
  });

  it('readonly mode has no delete button', () => {
    render(<DayRow day={makeRunDay()} onUpdate={noop} onDelete={noop} readonly={true} />);
    expect(screen.queryByTitle('Delete day')).not.toBeInTheDocument();
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

  it('delete button calls onDelete with the day date', async () => {
    const onDelete = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRestDay()} onUpdate={noop} onDelete={onDelete} />);
    fireEvent.click(screen.getByTitle('Delete day'));
    await vi.waitFor(() => {
      expect(onDelete).toHaveBeenCalledWith('2026-04-08');
    });
  });
});
