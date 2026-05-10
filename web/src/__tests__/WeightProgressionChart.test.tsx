import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WeightProgressionChart } from '../components/dashboard/WeightProgressionChart';

// Mock recharts to avoid chart rendering issues in tests
vi.mock('recharts', () => ({
  LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
  Line: () => null,
  XAxis: () => null,
  YAxis: () => null,
  CartesianGrid: () => null,
  Tooltip: () => null,
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('WeightProgressionChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('access_token', 'test-token');
  });

  it('renders exercise dropdown with all options', () => {
    const exerciseOptions = ['Squat', 'Bench Press', 'Deadlift'];
    render(<WeightProgressionChart exerciseOptions={exerciseOptions} />);

    const select = screen.getByRole('combobox') as HTMLSelectElement;
    expect(select).toBeInTheDocument();

    // Check all options are present
    const options = select.querySelectorAll('option');
    expect(options.length).toBe(4); // 1 placeholder + 3 exercises
    expect(options[0].textContent).toBe('Select exercise');
    expect(options[1].textContent).toBe('Squat');
    expect(options[2].textContent).toBe('Bench Press');
    expect(options[3].textContent).toBe('Deadlift');
  });

  it('shows "Select an exercise to see weight progression" when no exercise is selected', () => {
    render(<WeightProgressionChart exerciseOptions={['Squat']} />);
    expect(screen.getByText('Select an exercise to see weight progression')).toBeInTheDocument();
  });

  it('shows "No weight data for Squat" when exercise has no data', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    render(<WeightProgressionChart exerciseOptions={['Squat']} />);
    const select = screen.getByDisplayValue('Select exercise');
    fireEvent.change(select, { target: { value: 'Squat' } });

    await waitFor(() => {
      expect(screen.getByText('No weight data for Squat')).toBeInTheDocument();
    });

    mockFetch.mockRestore();
  });

  it('fetches exercise-weights API with X-Authorization header', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exercise: 'Squat',
        data: [{ date: '2026-04-01', maxWeight: 80, unit: 'kg' }],
      }),
    } as Response);

    render(<WeightProgressionChart exerciseOptions={['Squat']} />);
    const select = screen.getByDisplayValue('Select exercise');
    fireEvent.change(select, { target: { value: 'Squat' } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/runs/exercise-weights?exercise=Squat',
        { headers: { 'X-Authorization': 'Bearer test-token' } }
      );
    });

    mockFetch.mockRestore();
  });

  it('shows "Loading..." while fetching data', async () => {
    let resolveResponse: any;
    const mockFetch = vi.spyOn(global, 'fetch').mockReturnValueOnce(
      new Promise((resolve) => {
        resolveResponse = resolve;
      })
    );

    render(<WeightProgressionChart exerciseOptions={['Squat']} />);
    const select = screen.getByDisplayValue('Select exercise');
    fireEvent.change(select, { target: { value: 'Squat' } });

    // Should show loading immediately
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Resolve the mock fetch
    resolveResponse({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    await waitFor(() => {
      expect(screen.queryByText('Loading...')).not.toBeInTheDocument();
    });

    mockFetch.mockRestore();
  });

  it('renders LineChart when data is available', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exercise: 'Squat',
        data: [
          { date: '2026-04-01', maxWeight: 80, unit: 'kg' },
          { date: '2026-04-08', maxWeight: 85, unit: 'kg' },
        ],
      }),
    } as Response);

    render(<WeightProgressionChart exerciseOptions={['Squat']} />);
    const select = screen.getByDisplayValue('Select exercise');
    fireEvent.change(select, { target: { value: 'Squat' } });

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    mockFetch.mockRestore();
  });

  it('clears chart data when dropdown is cleared', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        data: [{ date: '2026-04-01', maxWeight: 80, unit: 'kg' }],
      }),
    } as Response);

    render(<WeightProgressionChart exerciseOptions={['Squat']} />);
    const select = screen.getByDisplayValue('Select exercise') as HTMLSelectElement;

    // Select an exercise
    fireEvent.change(select, { target: { value: 'Squat' } });

    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    // Clear selection
    fireEvent.change(select, { target: { value: '' } });

    expect(screen.getByText('Select an exercise to see weight progression')).toBeInTheDocument();
    expect(screen.queryByTestId('line-chart')).not.toBeInTheDocument();

    mockFetch.mockRestore();
  });

  it('handles API errors gracefully', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: false,
    } as Response);

    render(<WeightProgressionChart exerciseOptions={['Squat']} />);
    const select = screen.getByDisplayValue('Select exercise');
    fireEvent.change(select, { target: { value: 'Squat' } });

    await waitFor(() => {
      expect(screen.getByText('No weight data for Squat')).toBeInTheDocument();
    });

    mockFetch.mockRestore();
  });

  it('handles network errors gracefully', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockRejectedValueOnce(new Error('Network error'));

    render(<WeightProgressionChart exerciseOptions={['Squat']} />);
    const select = screen.getByDisplayValue('Select exercise');
    fireEvent.change(select, { target: { value: 'Squat' } });

    await waitFor(() => {
      expect(screen.getByText('No weight data for Squat')).toBeInTheDocument();
    });

    mockFetch.mockRestore();
  });

  it('renders empty state when exerciseOptions is empty', () => {
    render(<WeightProgressionChart exerciseOptions={[]} />);
    expect(screen.getByText('Log a gym session with exercises to see weight progression')).toBeInTheDocument();
  });

  it('URL-encodes exercise name in API request', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({ data: [] }),
    } as Response);

    render(<WeightProgressionChart exerciseOptions={['Bench Press']} />);
    const select = screen.getByDisplayValue('Select exercise');
    fireEvent.change(select, { target: { value: 'Bench Press' } });

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/runs/exercise-weights?exercise=Bench%20Press',
        expect.any(Object)
      );
    });

    mockFetch.mockRestore();
  });
});

describe('defaultExercise prop', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.setItem('access_token', 'test-token');
  });

  it('auto-fetches and selects the defaultExercise on mount', async () => {
    const mockFetch = vi.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        exercise: 'Squat',
        data: [{ date: '2026-04-01', maxWeight: 80, unit: 'kg' }],
      }),
    } as Response);

    render(<WeightProgressionChart exerciseOptions={['Squat', 'Bench Press']} defaultExercise="Squat" />);

    // Should auto-fetch on mount
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/runs/exercise-weights?exercise=Squat',
        expect.any(Object)
      );
    });

    // Chart should show data
    await waitFor(() => {
      expect(screen.getByTestId('line-chart')).toBeInTheDocument();
    });

    mockFetch.mockRestore();
  });

  it('renders without auto-fetch when defaultExercise is not provided', () => {
    render(<WeightProgressionChart exerciseOptions={['Squat']} />);
    expect(screen.getByText('Select an exercise to see weight progression')).toBeInTheDocument();
  });
});
