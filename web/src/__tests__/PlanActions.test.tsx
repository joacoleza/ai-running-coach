import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanActions } from '../components/plan/PlanActions';

beforeEach(() => {
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
});

const base = { onUpdate: vi.fn(), onArchive: vi.fn() };

describe('PlanActions — no active plan', () => {
  it('renders nothing when hasActivePlan is false', () => {
    const { container } = render(<PlanActions hasActivePlan={false} {...base} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('PlanActions — with active plan', () => {
  it('shows Update Plan and Archive buttons', () => {
    render(<PlanActions hasActivePlan={true} {...base} />);
    expect(screen.getByRole('button', { name: /update plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close & archive/i })).toBeInTheDocument();
  });

  it('does not show New Plan or Continue Planning buttons', () => {
    render(<PlanActions hasActivePlan={true} {...base} />);
    expect(screen.queryByRole('button', { name: /new plan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /continue planning/i })).not.toBeInTheDocument();
  });

  it('calls onUpdate when Update Plan clicked', () => {
    const onUpdate = vi.fn();
    render(<PlanActions hasActivePlan={true} {...base} onUpdate={onUpdate} />);
    fireEvent.click(screen.getByRole('button', { name: /update plan/i }));
    expect(onUpdate).toHaveBeenCalled();
  });

  it('calls onArchive after confirm when Archive clicked', () => {
    const onArchive = vi.fn();
    render(<PlanActions hasActivePlan={true} {...base} onArchive={onArchive} />);
    fireEvent.click(screen.getByRole('button', { name: /close & archive/i }));
    expect(onArchive).toHaveBeenCalled();
  });

  it('Update Plan and Close & Archive buttons have cursor-pointer', () => {
    render(<PlanActions hasActivePlan={true} {...base} />);
    expect(screen.getByRole('button', { name: /update plan/i }).className).toContain('cursor-pointer');
    expect(screen.getByRole('button', { name: /close & archive/i }).className).toContain('cursor-pointer');
  });

  it('does NOT call onArchive when confirm is cancelled', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const onArchive = vi.fn();
    render(<PlanActions hasActivePlan={true} {...base} onArchive={onArchive} />);
    fireEvent.click(screen.getByRole('button', { name: /close & archive/i }));
    expect(onArchive).not.toHaveBeenCalled();
  });
});
