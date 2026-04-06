import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Coach } from '../pages/Coach';
import { Dashboard } from '../pages/Dashboard';

describe('Coach page', () => {
  it('renders heading', () => {
    render(<Coach />);
    expect(screen.getByRole('heading', { name: /coach chat/i })).toBeInTheDocument();
  });
});

describe('Dashboard page', () => {
  it('renders heading', () => {
    render(<Dashboard />);
    expect(screen.getByRole('heading', { name: /dashboard/i })).toBeInTheDocument();
  });
});
