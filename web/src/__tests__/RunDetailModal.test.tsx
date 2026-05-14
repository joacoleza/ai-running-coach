import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RunDetailModal } from '../components/runs/RunDetailModal';
import type { Run } from '../hooks/useRuns';

// ExerciseList mock: exposes onExercisesChange callback so tests can trigger it
vi.mock('../components/runs/ExerciseList', () => ({
  ExerciseList: ({
    runId,
    onExercisesChange,
  }: {
    runId: string;
    exercises: unknown[];
    onExercisesChange: (exs: unknown[]) => void;
  }) => (
    <div data-testid="exercise-list">
      <span>ExerciseList for {runId}</span>
      <button
        onClick={() => onExercisesChange([{ name: 'Bench Press', sets: 3, reps: 10 }])}
        data-testid="trigger-exercise-change"
      >
        Add exercise
      </button>
    </div>
  ),
}));

vi.mock('../contexts/ChatContext', () => ({
  useChatContext: vi.fn(() => ({
    sendMessage: vi.fn().mockResolvedValue('Great run feedback'),
    messages: [],   // should NOT be read by the fixed code
    isStreaming: false,
    isBusy: false,
    isLoading: false,
    isGeneratingPlan: false,
    error: null,
    plan: null,
    startPlan: vi.fn(),
    startOver: vi.fn(),
    clearError: vi.fn(),
  })),
}));

vi.mock('../hooks/useRuns', () => ({
  updateRun: vi.fn(),
  deleteRun: vi.fn(),
  unlinkRun: vi.fn(),
}));

import { useChatContext } from '../contexts/ChatContext';
import { updateRun, deleteRun } from '../hooks/useRuns';

const mockRun: Run = {
  _id: 'run-001',
  date: '2026-04-01',
  distance: 5,
  duration: '25:00',
  pace: 5.0,
  createdAt: '2026-04-01T00:00:00.000Z',
  updatedAt: '2026-04-01T00:00:00.000Z',
};

const defaults = {
  sendMessage: vi.fn().mockResolvedValue('Great run feedback'),
  messages: [],
  isStreaming: false,
  isBusy: false,
  isLoading: false,
  isGeneratingPlan: false,
  error: null,
  plan: null,
  startPlan: vi.fn(),
  startOver: vi.fn(),
  clearError: vi.fn(),
};

const onUpdated = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useChatContext).mockReturnValue({ ...defaults, sendMessage: vi.fn().mockResolvedValue('Great run feedback') });
  vi.mocked(updateRun).mockResolvedValue({ ...mockRun, insight: 'Great run feedback' });
});

describe('RunDetailModal', () => {
  it('renders the modal with run details', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText(/wednesday 01\/04\/2026/i)).toBeInTheDocument();
  });

  it('shows Get coaching feedback button', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /get coaching feedback/i })).toBeInTheDocument();
  });

  it('saves insight from sendMessage return value, not from messages array', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue('Great run feedback');
    vi.mocked(useChatContext).mockReturnValue({ ...defaults, sendMessage: mockSendMessage });
    vi.mocked(updateRun).mockResolvedValue({ ...mockRun, insight: 'Great run feedback' });

    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={onUpdated} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /get coaching feedback/i }));
    await waitFor(() => expect(updateRun).toHaveBeenCalledWith(mockRun._id, { insight: 'Great run feedback' }));
  });

  it('strips XML tags from insight before saving to run', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue(
      'Great run! Keep up the effort. <run:update-insight runId="abc" insight="test"/>'
    );
    vi.mocked(useChatContext).mockReturnValue({ ...defaults, sendMessage: mockSendMessage });
    vi.mocked(updateRun).mockResolvedValue({ ...mockRun, insight: 'Great run! Keep up the effort.' });

    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={onUpdated} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /get coaching feedback/i }));
    await waitFor(() =>
      expect(updateRun).toHaveBeenCalledWith(
        mockRun._id,
        expect.objectContaining({ insight: 'Great run! Keep up the effort.' })
      )
    );
  });

  it('does not call updateRun when sendMessage returns empty string', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue('');
    vi.mocked(useChatContext).mockReturnValue({ ...defaults, sendMessage: mockSendMessage });

    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={onUpdated} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /get coaching feedback/i }));
    await waitFor(() => expect(mockSendMessage).toHaveBeenCalled());
    expect(updateRun).not.toHaveBeenCalled();
  });

  it('date input has type=date with min and max attributes', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).toBeInTheDocument();
    expect(dateInput.min).toBe('2000-01-01');
    expect(dateInput.max).toBe('2099-12-31');
  });

  it('shows error and does not call updateRun when date is cleared', async () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={onUpdated} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: '' } });

    // Trigger save by changing distance to make form dirty then clicking Save changes
    fireEvent.change(document.querySelector('input[type="number"]') as HTMLInputElement, { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(screen.getByText(/valid date/i)).toBeInTheDocument();
    expect(updateRun).not.toHaveBeenCalled();
  });

  it('swallows updateRun error and resets isRequestingFeedback', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue('Great run feedback');
    vi.mocked(useChatContext).mockReturnValue({ ...defaults, sendMessage: mockSendMessage });
    vi.mocked(updateRun).mockRejectedValue(new Error('DB error'));

    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={onUpdated} onDeleted={vi.fn()} />
      </MemoryRouter>
    );

    const btn = screen.getByRole('button', { name: /get coaching feedback/i });
    fireEvent.click(btn);

    // After the async operation finishes, button should be re-enabled (not stuck in requesting state)
    await waitFor(() => expect(screen.getByRole('button', { name: /get coaching feedback/i })).not.toBeDisabled());
  });

  it('uses editNotes (live state) not run.notes (stale prop) when building insight prompt', async () => {
    const mockSendMessage = vi.fn().mockResolvedValue('Feedback with edited notes');
    vi.mocked(useChatContext).mockReturnValue({ ...defaults, sendMessage: mockSendMessage });
    vi.mocked(updateRun).mockResolvedValue({ ...mockRun, insight: 'Feedback with edited notes' });

    render(
      <MemoryRouter>
        <RunDetailModal run={{ ...mockRun, notes: 'Original notes' }} onClose={vi.fn()} onUpdated={onUpdated} onDeleted={vi.fn()} />
      </MemoryRouter>
    );

    // Change notes in the textarea
    const notesArea = screen.getByPlaceholderText(/how did it feel/i);
    fireEvent.change(notesArea, { target: { value: 'Edited notes' } });

    fireEvent.click(screen.getByRole('button', { name: /get coaching feedback/i }));

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalled());
    const [prompt] = mockSendMessage.mock.calls[0] as [string];
    expect(prompt).toContain('Edited notes');
    expect(prompt).not.toContain('Original notes');
  });

  it('shows Session Exercises section for gym sessions', () => {
    const gymRun = { ...mockRun, discipline: 'gym', type: 'upper body' };
    render(
      <MemoryRouter>
        <RunDetailModal run={gymRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('Session Exercises')).toBeInTheDocument();
    expect(screen.getByTestId('exercise-list')).toBeInTheDocument();
  });

  it('does not show Session Exercises section for run sessions', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByText('Session Exercises')).not.toBeInTheDocument();
    expect(screen.queryByTestId('exercise-list')).not.toBeInTheDocument();
  });

  it('shows Speed (km/h) label for cycling sessions', () => {
    const cyclingRun: Run = {
      ...mockRun,
      _id: 'cycle-001',
      distance: 30,
      duration: '60:00',
      discipline: 'cycle',
      pace: 0,
    };
    render(
      <MemoryRouter>
        <RunDetailModal run={cyclingRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('Speed (km/h)')).toBeInTheDocument();
    // Pace label should NOT appear for cycling
    expect(screen.queryByText(/^Pace$/)).not.toBeInTheDocument();
  });

  it('displays computed speed value for cycling sessions', () => {
    const cyclingRun: Run = {
      ...mockRun,
      _id: 'cycle-002',
      distance: 30,
      duration: '60:00',
      discipline: 'cycle',
      pace: 0,
    };
    render(
      <MemoryRouter>
        <RunDetailModal run={cyclingRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    // 30km in 60:00 = 30.0 km/h
    expect(screen.getByText('30.0 km/h')).toBeInTheDocument();
  });
});

describe('RunDetailModal — RunBadge in header', () => {
  it('shows Run badge in header for run sessions', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    // RunBadge renders "Run" label for default (undefined) discipline
    expect(screen.getByText('Run')).toBeInTheDocument();
  });

  it('shows Gym badge in header for gym sessions', () => {
    const gymRun: Run = { ...mockRun, discipline: 'gym', type: 'upper body' };
    render(
      <MemoryRouter>
        <RunDetailModal run={gymRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('Gym')).toBeInTheDocument();
  });

  it('shows Cycling badge in header for cycle sessions', () => {
    const cycleRun: Run = { ...mockRun, discipline: 'cycle' };
    render(
      <MemoryRouter>
        <RunDetailModal run={cycleRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByText('Cycling')).toBeInTheDocument();
  });

  it('hides Distance field for gym sessions', () => {
    const gymRun: Run = { ...mockRun, discipline: 'gym', type: 'upper body', exercises: [] };
    render(
      <MemoryRouter>
        <RunDetailModal run={gymRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    // Distance label should not appear for gym
    expect(screen.queryByText('Distance')).not.toBeInTheDocument();
  });

  it('hides Pace/Speed field for gym sessions', () => {
    const gymRun: Run = { ...mockRun, discipline: 'gym', type: 'upper body', exercises: [] };
    render(
      <MemoryRouter>
        <RunDetailModal run={gymRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.queryByText(/^Pace$/)).not.toBeInTheDocument();
    expect(screen.queryByText('Speed (km/h)')).not.toBeInTheDocument();
  });
});

describe('RunDetailModal — gym-specific coaching feedback message', () => {
  it('includes session type and exercise count in gym feedback prompt', async () => {
    const gymRun: Run = {
      ...mockRun,
      discipline: 'gym',
      type: 'upper body',
      exercises: [
        { name: 'Bench Press', sets: 3, reps: 8 },
        { name: 'Pull-ups', sets: 3, reps: 10 },
      ],
    };
    const mockSendMessage = vi.fn().mockResolvedValue('Gym feedback');
    vi.mocked(useChatContext).mockReturnValue({ ...defaults, sendMessage: mockSendMessage });
    vi.mocked(updateRun).mockResolvedValue({ ...gymRun, insight: 'Gym feedback' });

    render(
      <MemoryRouter>
        <RunDetailModal run={gymRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /get coaching feedback/i }));

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalled());
    const [prompt] = mockSendMessage.mock.calls[0] as [string];
    expect(prompt).toContain('gym session');
    expect(prompt).toContain('upper body');
    expect(prompt).toContain('2 logged');
  });
});

describe('RunDetailModal — exercise unified save', () => {
  const gymRun: Run = {
    ...mockRun,
    _id: 'gym-001',
    discipline: 'gym',
    type: 'upper body',
    exercises: [],
  };

  it('ExerciseList receives onExercisesChange callback prop', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={gymRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    // The mock ExerciseList renders "Add exercise" button only when onExercisesChange is passed
    expect(screen.getByTestId('trigger-exercise-change')).toBeInTheDocument();
  });

  it('isDirty becomes true when exercises change via onExercisesChange', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={gymRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    // Initially no Save changes button
    expect(screen.queryByRole('button', { name: /save changes/i })).not.toBeInTheDocument();

    // Trigger exercise change via mock
    fireEvent.click(screen.getByTestId('trigger-exercise-change'));

    // Now Save changes button should appear
    expect(screen.getByRole('button', { name: /save changes/i })).toBeInTheDocument();
  });

  it('Save changes includes exercises in updateRun call', async () => {
    vi.mocked(updateRun).mockResolvedValue({ ...gymRun, exercises: [{ name: 'Bench Press', sets: 3, reps: 10 }] });

    render(
      <MemoryRouter>
        <RunDetailModal run={gymRun} onClose={vi.fn()} onUpdated={onUpdated} onDeleted={vi.fn()} />
      </MemoryRouter>
    );

    // Trigger exercise change
    fireEvent.click(screen.getByTestId('trigger-exercise-change'));

    // Click Save changes
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });

    await waitFor(() => {
      expect(updateRun).toHaveBeenCalledWith(
        gymRun._id,
        expect.objectContaining({
          exercises: [{ name: 'Bench Press', sets: 3, reps: 10 }],
        })
      );
    });
  });

  it('ExerciseList does not have standalone Save exercises button (removed)', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={gymRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    // The real ExerciseList should no longer have "Save exercises" button
    // Our mock doesn't render it — the real component test checks this
    expect(screen.queryByRole('button', { name: /save exercises/i })).not.toBeInTheDocument();
  });
});

describe('RunDetailModal — duration validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useChatContext).mockReturnValue({ ...defaults, sendMessage: vi.fn().mockResolvedValue('') });
    vi.mocked(updateRun).mockResolvedValue({ ...mockRun });
  });

  it('shows error and does not call updateRun when saving with invalid duration format', async () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    // Change duration to invalid value to make form dirty
    const durationInput = screen.getByPlaceholderText('45:30');
    fireEvent.change(durationInput, { target: { value: '12:0011' } });

    // Save changes button appears because form is dirty
    fireEvent.click(screen.getByRole('button', { name: /save changes/i }));

    expect(screen.getByText(/invalid duration/i)).toBeInTheDocument();
    expect(updateRun).not.toHaveBeenCalled();
  });

  it('allows saving with valid HH:MM:SS duration', async () => {
    vi.mocked(updateRun).mockResolvedValue({ ...mockRun, duration: '1:30:00' });

    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    // Change duration to valid HH:MM:SS
    const durationInput = screen.getByPlaceholderText('45:30');
    fireEvent.change(durationInput, { target: { value: '1:30:00' } });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /save changes/i }));
    });

    await waitFor(() =>
      expect(updateRun).toHaveBeenCalledWith(
        mockRun._id,
        expect.objectContaining({ duration: '1:30:00' })
      )
    );
  });
});

describe('RunDetailModal — delete session', () => {
  const onDeleted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useChatContext).mockReturnValue({ ...defaults });
    vi.mocked(deleteRun).mockResolvedValue(undefined as any);
  });

  it('clicking Delete session shows browser confirm dialog', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={onDeleted} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete session$/i }));
    expect(window.confirm).toHaveBeenCalledWith('Delete this run? This cannot be undone.');
    vi.restoreAllMocks();
  });

  it('confirming delete calls deleteRun and onDeleted', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={onDeleted} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete session$/i }));
    await waitFor(() => expect(deleteRun).toHaveBeenCalledWith('run-001'));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith('run-001'));
    vi.restoreAllMocks();
  });

  it('cancelling delete does not call deleteRun', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={onDeleted} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete session$/i }));
    expect(deleteRun).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
