import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { RunDetailModal } from '../components/runs/RunDetailModal';
import type { Run } from '../hooks/useRuns';

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

  it('shows Add feedback to run button', () => {
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={vi.fn()} />
      </MemoryRouter>
    );
    expect(screen.getByRole('button', { name: /add feedback to run/i })).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole('button', { name: /add feedback to run/i }));
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
    fireEvent.click(screen.getByRole('button', { name: /add feedback to run/i }));
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
    fireEvent.click(screen.getByRole('button', { name: /add feedback to run/i }));
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

    const btn = screen.getByRole('button', { name: /add feedback to run/i });
    fireEvent.click(btn);

    // After the async operation finishes, button should be re-enabled (not stuck in requesting state)
    await waitFor(() => expect(screen.getByRole('button', { name: /add feedback to run/i })).not.toBeDisabled());
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

    fireEvent.click(screen.getByRole('button', { name: /add feedback to run/i }));

    await waitFor(() => expect(mockSendMessage).toHaveBeenCalled());
    const [prompt] = mockSendMessage.mock.calls[0] as [string];
    expect(prompt).toContain('Edited notes');
    expect(prompt).not.toContain('Original notes');
  });
});

describe('RunDetailModal — delete run', () => {
  const onDeleted = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useChatContext).mockReturnValue({ ...defaults });
    vi.mocked(deleteRun).mockResolvedValue(undefined as any);
  });

  it('clicking Delete run shows browser confirm dialog', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    render(
      <MemoryRouter>
        <RunDetailModal run={mockRun} onClose={vi.fn()} onUpdated={vi.fn()} onDeleted={onDeleted} />
      </MemoryRouter>
    );
    fireEvent.click(screen.getByRole('button', { name: /^delete run$/i }));
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
    fireEvent.click(screen.getByRole('button', { name: /^delete run$/i }));
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
    fireEvent.click(screen.getByRole('button', { name: /^delete run$/i }));
    expect(deleteRun).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
