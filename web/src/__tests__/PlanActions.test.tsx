import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanActions } from '../components/plan/PlanActions';

beforeEach(() => {
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
});

describe('PlanActions — no active plan', () => {
  it('shows New Plan button, hides Update/Archive', () => {
    render(
      <PlanActions
        hasActivePlan={false}
        onCreateNew={vi.fn()}
        onUpdate={vi.fn()}
        onArchive={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /new plan/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /update plan/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /close & archive/i })).not.toBeInTheDocument();
  });

  it('calls onCreateNew when New Plan clicked', () => {
    const onCreateNew = vi.fn();
    render(
      <PlanActions hasActivePlan={false} onCreateNew={onCreateNew} onUpdate={vi.fn()} onArchive={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /new plan/i }));
    expect(onCreateNew).toHaveBeenCalled();
  });
});

describe('PlanActions — with active plan', () => {
  it('shows Update Plan and Archive buttons, hides New Plan', () => {
    render(
      <PlanActions
        hasActivePlan={true}
        onCreateNew={vi.fn()}
        onUpdate={vi.fn()}
        onArchive={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button', { name: /new plan/i })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /update plan/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close & archive/i })).toBeInTheDocument();
  });

  it('calls onUpdate when Update Plan clicked', () => {
    const onUpdate = vi.fn();
    render(
      <PlanActions hasActivePlan={true} onCreateNew={vi.fn()} onUpdate={onUpdate} onArchive={vi.fn()} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /update plan/i }));
    expect(onUpdate).toHaveBeenCalled();
  });

  it('calls onArchive after confirm when Archive clicked', () => {
    const onArchive = vi.fn();
    render(
      <PlanActions hasActivePlan={true} onCreateNew={vi.fn()} onUpdate={vi.fn()} onArchive={onArchive} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /close & archive/i }));
    expect(window.confirm).toHaveBeenCalled();
    expect(onArchive).toHaveBeenCalled();
  });

  it('does NOT call onArchive when confirm is cancelled', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const onArchive = vi.fn();
    render(
      <PlanActions hasActivePlan={true} onCreateNew={vi.fn()} onUpdate={vi.fn()} onArchive={onArchive} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /close & archive/i }));
    expect(onArchive).not.toHaveBeenCalled();
  });
});
