import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { DisciplineSelector } from '../components/dashboard/DisciplineSelector';

describe('DisciplineSelector', () => {
  it('renders four buttons: All, Run, Gym, Cycle', () => {
    const mockOnChange = vi.fn();
    render(<DisciplineSelector activeDiscipline="all" onChange={mockOnChange} />);

    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Run' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Gym' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cycle' })).toBeInTheDocument();
  });

  it('calls onChange with correct discipline when button is clicked', () => {
    const mockOnChange = vi.fn();
    render(<DisciplineSelector activeDiscipline="all" onChange={mockOnChange} />);

    const gymButton = screen.getByRole('button', { name: 'Gym' });
    fireEvent.click(gymButton);

    expect(mockOnChange).toHaveBeenCalledWith('gym');
  });

  it('sets aria-pressed="true" on active discipline button', () => {
    const mockOnChange = vi.fn();
    render(<DisciplineSelector activeDiscipline="gym" onChange={mockOnChange} />);

    const gymButton = screen.getByRole('button', { name: 'Gym' });
    expect(gymButton).toHaveAttribute('aria-pressed', 'true');
  });

  it('sets aria-pressed="false" on inactive discipline buttons', () => {
    const mockOnChange = vi.fn();
    render(<DisciplineSelector activeDiscipline="gym" onChange={mockOnChange} />);

    const runButton = screen.getByRole('button', { name: 'Run' });
    const cycleButton = screen.getByRole('button', { name: 'Cycle' });

    expect(runButton).toHaveAttribute('aria-pressed', 'false');
    expect(cycleButton).toHaveAttribute('aria-pressed', 'false');
  });

  it('active button has bg-gray-200 class', () => {
    const mockOnChange = vi.fn();
    render(<DisciplineSelector activeDiscipline="run" onChange={mockOnChange} />);

    const runButton = screen.getByRole('button', { name: 'Run' });
    expect(runButton).toHaveClass('bg-gray-200');
  });

  it('inactive buttons have border and text-gray-600', () => {
    const mockOnChange = vi.fn();
    render(<DisciplineSelector activeDiscipline="run" onChange={mockOnChange} />);

    const gymButton = screen.getByRole('button', { name: 'Gym' });
    expect(gymButton).toHaveClass('border');
    expect(gymButton).toHaveClass('text-gray-600');
  });

  it('calls onChange for all button types', () => {
    const mockOnChange = vi.fn();
    render(<DisciplineSelector activeDiscipline="all" onChange={mockOnChange} />);

    const disciplines = ['All', 'Run', 'Gym', 'Cycle'];
    for (const label of disciplines) {
      const button = screen.getByRole('button', { name: label });
      fireEvent.click(button);
    }

    expect(mockOnChange).toHaveBeenCalledTimes(4);
    expect(mockOnChange).toHaveBeenCalledWith('all');
    expect(mockOnChange).toHaveBeenCalledWith('run');
    expect(mockOnChange).toHaveBeenCalledWith('gym');
    expect(mockOnChange).toHaveBeenCalledWith('cycle');
  });
});
