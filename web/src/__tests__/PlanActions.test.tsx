import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PlanActions } from '../components/plan/PlanActions';

beforeEach(() => {
  vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
});

const base = { onArchive: vi.fn() };

describe('PlanActions — no active plan', () => {
  it('renders nothing when hasActivePlan is false', () => {
    const { container } = render(<PlanActions hasActivePlan={false} {...base} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('PlanActions — with active plan', () => {
  it('shows Archive button', () => {
    render(<PlanActions hasActivePlan={true} {...base} />);
    expect(screen.getByRole('button', { name: /archive/i })).toBeInTheDocument();
  });

  it('does not show Update Plan button', () => {
    render(<PlanActions hasActivePlan={true} {...base} />);
    expect(screen.queryByRole('button', { name: /update plan/i })).not.toBeInTheDocument();
  });

  it('calls onArchive after confirm when Archive clicked', () => {
    const onArchive = vi.fn();
    render(<PlanActions hasActivePlan={true} onArchive={onArchive} />);
    fireEvent.click(screen.getByRole('button', { name: /archive/i }));
    expect(onArchive).toHaveBeenCalled();
  });

  it('Archive button has cursor-pointer', () => {
    render(<PlanActions hasActivePlan={true} {...base} />);
    expect(screen.getByRole('button', { name: /archive/i }).className).toContain('cursor-pointer');
  });

  it('does NOT call onArchive when confirm is cancelled', () => {
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(false));
    const onArchive = vi.fn();
    render(<PlanActions hasActivePlan={true} onArchive={onArchive} />);
    fireEvent.click(screen.getByRole('button', { name: /archive/i }));
    expect(onArchive).not.toHaveBeenCalled();
  });
});
