import { render, screen, fireEvent, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PhaseHeader } from '../components/plan/PhaseHeader';
import type { PlanPhase } from '../hooks/usePlan';

const phase: PlanPhase = {
  name: 'Base Phase',
  description: 'Build your aerobic base',
  weeks: [],
};

const defaultProps = {
  phase,
  phaseIndex: 0,
  isLastPhase: true,
  totalPhases: 2,
  onUpdatePhase: vi.fn().mockResolvedValue(undefined),
  onDeletePhase: vi.fn().mockResolvedValue(undefined),
  readonly: false,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

describe('PhaseHeader — title editing', () => {
  it('renders phase name as h2 with edit cursor when not readonly', () => {
    render(<PhaseHeader {...defaultProps} />);
    const h2 = screen.getByText('Base Phase');
    expect(h2.tagName).toBe('H2');
    expect(h2.className).toContain('cursor-pointer');
  });

  it('does not show edit cursor on title when readonly', () => {
    render(<PhaseHeader {...defaultProps} readonly={true} />);
    const h2 = screen.getByText('Base Phase');
    expect(h2.className).not.toContain('cursor-pointer');
  });

  it('clicking title shows input with current value', () => {
    render(<PhaseHeader {...defaultProps} />);
    fireEvent.click(screen.getByText('Base Phase'));
    const input = screen.getByRole('textbox', { name: 'Phase name' });
    expect(input).toBeInTheDocument();
    expect((input as HTMLInputElement).value).toBe('Base Phase');
  });

  it('pressing Enter saves the new title', async () => {
    render(<PhaseHeader {...defaultProps} />);
    fireEvent.click(screen.getByText('Base Phase'));
    const input = screen.getByRole('textbox', { name: 'Phase name' });
    fireEvent.change(input, { target: { value: 'New Name' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    expect(defaultProps.onUpdatePhase).toHaveBeenCalledWith(0, { name: 'New Name' });
  });

  it('pressing Escape cancels editing without saving', () => {
    render(<PhaseHeader {...defaultProps} />);
    fireEvent.click(screen.getByText('Base Phase'));
    const input = screen.getByRole('textbox', { name: 'Phase name' });
    fireEvent.change(input, { target: { value: 'Changed' } });
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(defaultProps.onUpdatePhase).not.toHaveBeenCalled();
    expect(screen.getByText('Base Phase')).toBeInTheDocument();
  });

  it('blur saves the title', async () => {
    render(<PhaseHeader {...defaultProps} />);
    fireEvent.click(screen.getByText('Base Phase'));
    const input = screen.getByRole('textbox', { name: 'Phase name' });
    fireEvent.change(input, { target: { value: 'Blurred Title' } });
    await act(async () => { fireEvent.blur(input); });
    expect(defaultProps.onUpdatePhase).toHaveBeenCalledWith(0, { name: 'Blurred Title' });
  });

  it('shows validation error when title is empty', async () => {
    render(<PhaseHeader {...defaultProps} />);
    fireEvent.click(screen.getByText('Base Phase'));
    const input = screen.getByRole('textbox', { name: 'Phase name' });
    fireEvent.change(input, { target: { value: '   ' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    expect(screen.getByText('Phase name cannot be empty')).toBeInTheDocument();
    expect(defaultProps.onUpdatePhase).not.toHaveBeenCalled();
  });

  it('does not call API if title is unchanged', async () => {
    render(<PhaseHeader {...defaultProps} />);
    fireEvent.click(screen.getByText('Base Phase'));
    const input = screen.getByRole('textbox', { name: 'Phase name' });
    // Value stays the same
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    expect(defaultProps.onUpdatePhase).not.toHaveBeenCalled();
  });

  it('shows error message when API rejects', async () => {
    const onUpdatePhase = vi.fn().mockRejectedValue(new Error('Server error'));
    render(<PhaseHeader {...defaultProps} onUpdatePhase={onUpdatePhase} />);
    fireEvent.click(screen.getByText('Base Phase'));
    const input = screen.getByRole('textbox', { name: 'Phase name' });
    fireEvent.change(input, { target: { value: 'New Name' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    expect(screen.getByText('Server error')).toBeInTheDocument();
  });

  it('shows generic error when API rejects with non-Error', async () => {
    const onUpdatePhase = vi.fn().mockRejectedValue('oops');
    render(<PhaseHeader {...defaultProps} onUpdatePhase={onUpdatePhase} />);
    fireEvent.click(screen.getByText('Base Phase'));
    const input = screen.getByRole('textbox', { name: 'Phase name' });
    fireEvent.change(input, { target: { value: 'New Name' } });
    await act(async () => { fireEvent.keyDown(input, { key: 'Enter' }); });
    expect(screen.getByText('Failed to update phase name')).toBeInTheDocument();
  });

  it('sync title state when phase prop changes', () => {
    const { rerender } = render(<PhaseHeader {...defaultProps} />);
    const updatedPhase = { ...phase, name: 'Updated Phase' };
    rerender(<PhaseHeader {...defaultProps} phase={updatedPhase} />);
    expect(screen.getByText('Updated Phase')).toBeInTheDocument();
  });
});

describe('PhaseHeader — description editing', () => {
  it('renders description text with edit cursor when not readonly', () => {
    render(<PhaseHeader {...defaultProps} />);
    const p = screen.getByText('Build your aerobic base');
    expect(p.className).toContain('cursor-pointer');
  });

  it('clicking description shows textarea with current value', () => {
    render(<PhaseHeader {...defaultProps} />);
    fireEvent.click(screen.getByText('Build your aerobic base'));
    const textarea = screen.getByRole('textbox', { name: 'Phase description' });
    expect((textarea as HTMLTextAreaElement).value).toBe('Build your aerobic base');
  });

  it('pressing Escape cancels description edit', () => {
    render(<PhaseHeader {...defaultProps} />);
    fireEvent.click(screen.getByText('Build your aerobic base'));
    const textarea = screen.getByRole('textbox', { name: 'Phase description' });
    fireEvent.change(textarea, { target: { value: 'Changed' } });
    fireEvent.keyDown(textarea, { key: 'Escape' });
    expect(defaultProps.onUpdatePhase).not.toHaveBeenCalled();
    expect(screen.getByText('Build your aerobic base')).toBeInTheDocument();
  });

  it('blur saves the description', async () => {
    render(<PhaseHeader {...defaultProps} />);
    fireEvent.click(screen.getByText('Build your aerobic base'));
    const textarea = screen.getByRole('textbox', { name: 'Phase description' });
    fireEvent.change(textarea, { target: { value: 'New description' } });
    await act(async () => { fireEvent.blur(textarea); });
    expect(defaultProps.onUpdatePhase).toHaveBeenCalledWith(0, { description: 'New description' });
  });

  it('does not call API if description is unchanged', async () => {
    render(<PhaseHeader {...defaultProps} />);
    fireEvent.click(screen.getByText('Build your aerobic base'));
    const textarea = screen.getByRole('textbox', { name: 'Phase description' });
    await act(async () => { fireEvent.blur(textarea); });
    expect(defaultProps.onUpdatePhase).not.toHaveBeenCalled();
  });

  it('shows error when description API rejects', async () => {
    const onUpdatePhase = vi.fn().mockRejectedValue(new Error('Desc error'));
    render(<PhaseHeader {...defaultProps} onUpdatePhase={onUpdatePhase} />);
    fireEvent.click(screen.getByText('Build your aerobic base'));
    const textarea = screen.getByRole('textbox', { name: 'Phase description' });
    fireEvent.change(textarea, { target: { value: 'Changed' } });
    await act(async () => { fireEvent.blur(textarea); });
    expect(screen.getByText('Desc error')).toBeInTheDocument();
  });

  it('shows generic error when description API rejects with non-Error', async () => {
    const onUpdatePhase = vi.fn().mockRejectedValue('oops');
    render(<PhaseHeader {...defaultProps} onUpdatePhase={onUpdatePhase} />);
    fireEvent.click(screen.getByText('Build your aerobic base'));
    const textarea = screen.getByRole('textbox', { name: 'Phase description' });
    fireEvent.change(textarea, { target: { value: 'Changed' } });
    await act(async () => { fireEvent.blur(textarea); });
    expect(screen.getByText('Failed to update phase description')).toBeInTheDocument();
  });

  it('shows "Add description…" placeholder when description is empty and not readonly', () => {
    const phaseNoDesc = { ...phase, description: '' };
    render(<PhaseHeader {...defaultProps} phase={phaseNoDesc} />);
    expect(screen.getByText('Add description…')).toBeInTheDocument();
  });

  it('shows nothing for empty description in readonly mode', () => {
    const phaseNoDesc = { ...phase, description: '' };
    render(<PhaseHeader {...defaultProps} phase={phaseNoDesc} readonly={true} />);
    expect(screen.queryByText('Add description…')).not.toBeInTheDocument();
  });

  it('syncs description state when phase prop changes', () => {
    const { rerender } = render(<PhaseHeader {...defaultProps} />);
    const updatedPhase = { ...phase, description: 'Updated description' };
    rerender(<PhaseHeader {...defaultProps} phase={updatedPhase} />);
    expect(screen.getByText('Updated description')).toBeInTheDocument();
  });
});

describe('PhaseHeader — delete phase', () => {
  it('shows delete button on last phase when totalPhases > 1 and not readonly', () => {
    render(<PhaseHeader {...defaultProps} />);
    expect(screen.getByTitle('Delete last phase')).toBeInTheDocument();
  });

  it('does not show delete button when not last phase', () => {
    render(<PhaseHeader {...defaultProps} isLastPhase={false} />);
    expect(screen.queryByTitle('Delete last phase')).not.toBeInTheDocument();
  });

  it('does not show delete button when only one phase exists', () => {
    render(<PhaseHeader {...defaultProps} totalPhases={1} />);
    expect(screen.queryByTitle('Delete last phase')).not.toBeInTheDocument();
  });

  it('does not show delete button in readonly mode', () => {
    render(<PhaseHeader {...defaultProps} readonly={true} />);
    expect(screen.queryByTitle('Delete last phase')).not.toBeInTheDocument();
  });

  it('calls onDeletePhase after confirm', async () => {
    render(<PhaseHeader {...defaultProps} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Delete last phase')); });
    expect(window.confirm).toHaveBeenCalledWith('Delete the last phase "Base Phase"? This cannot be undone.');
    expect(defaultProps.onDeletePhase).toHaveBeenCalledTimes(1);
  });

  it('does not call onDeletePhase when confirm is cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(<PhaseHeader {...defaultProps} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Delete last phase')); });
    expect(defaultProps.onDeletePhase).not.toHaveBeenCalled();
  });

  it('shows alert when delete API rejects with Error', async () => {
    const onDeletePhase = vi.fn().mockRejectedValue(new Error('Cannot delete'));
    render(<PhaseHeader {...defaultProps} onDeletePhase={onDeletePhase} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Delete last phase')); });
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Cannot delete'));
  });

  it('shows generic alert when delete API rejects with non-Error', async () => {
    const onDeletePhase = vi.fn().mockRejectedValue('oops');
    render(<PhaseHeader {...defaultProps} onDeletePhase={onDeletePhase} />);
    await act(async () => { fireEvent.click(screen.getByTitle('Delete last phase')); });
    await waitFor(() => expect(window.alert).toHaveBeenCalledWith('Failed to delete phase'));
  });
});
