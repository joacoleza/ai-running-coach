import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { RunBadge } from '../components/runs/RunBadge';

describe('RunBadge', () => {
  it('renders Run badge with blue styling', () => {
    const { container } = render(<RunBadge discipline="run" />);
    expect(screen.getByText('Run')).toBeInTheDocument();
    const span = container.querySelector('span.bg-blue-100');
    expect(span).not.toBeNull();
    expect(span).toHaveClass('text-blue-700');
  });

  it('renders Gym badge with orange styling', () => {
    const { container } = render(<RunBadge discipline="gym" />);
    expect(screen.getByText('Gym')).toBeInTheDocument();
    const span = container.querySelector('span.bg-orange-100');
    expect(span).not.toBeNull();
    expect(span).toHaveClass('text-orange-700');
  });

  it('renders Cycling badge with green styling', () => {
    const { container } = render(<RunBadge discipline="cycle" />);
    expect(screen.getByText('Cycling')).toBeInTheDocument();
    const span = container.querySelector('span.bg-green-100');
    expect(span).not.toBeNull();
    expect(span).toHaveClass('text-green-700');
  });

  it('renders as inline-flex span', () => {
    const { container } = render(<RunBadge discipline="run" />);
    const outer = container.querySelector('span.inline-flex');
    expect(outer).not.toBeNull();
    expect(outer).toHaveClass('rounded-full', 'text-xs', 'font-medium');
  });
});
