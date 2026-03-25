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

describe('DayRow', () => {
  it('renders day date and guidelines', () => {
    const onUpdate = vi.fn();
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} />);
    expect(screen.getByText('2026-04-07')).toBeInTheDocument();
    expect(screen.getByText('Easy Zone 2 run')).toBeInTheDocument();
  });

  it('clicking guidelines enters edit mode with input', () => {
    const onUpdate = vi.fn();
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} />);
    const guidelinesSpan = screen.getByText('Easy Zone 2 run');
    fireEvent.click(guidelinesSpan);
    const input = screen.getByDisplayValue('Easy Zone 2 run');
    expect(input.tagName).toBe('INPUT');
  });

  it('saving edit on blur calls onUpdate with new guidelines', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} />);
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
    const onUpdate = vi.fn();
    render(<DayRow day={makeRunDay({ completed: true })} onUpdate={onUpdate} />);
    // Action buttons should not be visible (no skip/complete buttons)
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as skipped')).not.toBeInTheDocument();
    // Clicking guidelines should not enter edit mode
    const guidelinesSpan = screen.getByText('Easy Zone 2 run');
    fireEvent.click(guidelinesSpan);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('clicking complete button calls onUpdate with completed true', async () => {
    const onUpdate = vi.fn().mockResolvedValue(undefined);
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} />);
    const completeBtn = screen.getByTitle('Mark as completed');
    fireEvent.click(completeBtn);
    await vi.waitFor(() => {
      expect(onUpdate).toHaveBeenCalledWith('2026-04-07', { completed: 'true' });
    });
  });

  it('readonly mode hides all action controls', () => {
    const onUpdate = vi.fn();
    render(<DayRow day={makeRunDay()} onUpdate={onUpdate} readonly={true} />);
    expect(screen.queryByTitle('Mark as completed')).not.toBeInTheDocument();
    expect(screen.queryByTitle('Mark as skipped')).not.toBeInTheDocument();
    // Clicking guidelines should not enter edit mode in readonly
    const guidelinesSpan = screen.getByText('Easy Zone 2 run');
    fireEvent.click(guidelinesSpan);
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });
});
