import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ImportUrlForm } from '../components/plan/ImportUrlForm';

const VALID_URL = 'https://chatgpt.com/share/abc-123';

describe('ImportUrlForm', () => {
  let onImport: ReturnType<typeof vi.fn>;
  let onCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    onImport = vi.fn().mockResolvedValue(undefined);
    onCancel = vi.fn();
  });

  it('renders input and buttons', () => {
    render(<ImportUrlForm onImport={onImport} onCancel={onCancel} />);
    expect(screen.getByPlaceholderText(/chatgpt.com\/share/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^import$/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('calls onCancel when Cancel is clicked', () => {
    render(<ImportUrlForm onImport={onImport} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('shows validation error for invalid URL', async () => {
    render(<ImportUrlForm onImport={onImport} onCancel={onCancel} />);
    fireEvent.change(screen.getByPlaceholderText(/chatgpt.com\/share/i), {
      target: { value: 'https://example.com/something' },
    });
    fireEvent.submit(screen.getByRole('button', { name: /^import$/i }).closest('form')!);
    await waitFor(() =>
      expect(screen.getByText(/url must start with https:\/\/chatgpt.com\/share\//i)).toBeInTheDocument(),
    );
    expect(onImport).not.toHaveBeenCalled();
  });

  it('calls onImport with valid URL', async () => {
    render(<ImportUrlForm onImport={onImport} onCancel={onCancel} />);
    fireEvent.change(screen.getByPlaceholderText(/chatgpt.com\/share/i), {
      target: { value: VALID_URL },
    });
    fireEvent.submit(screen.getByRole('button', { name: /^import$/i }).closest('form')!);
    await waitFor(() => expect(onImport).toHaveBeenCalledWith(VALID_URL));
  });

  it('shows error when onImport throws', async () => {
    onImport.mockRejectedValue(new Error('Network error'));
    render(<ImportUrlForm onImport={onImport} onCancel={onCancel} />);
    fireEvent.change(screen.getByPlaceholderText(/chatgpt.com\/share/i), {
      target: { value: VALID_URL },
    });
    fireEvent.submit(screen.getByRole('button', { name: /^import$/i }).closest('form')!);
    await waitFor(() => expect(screen.getByText('Network error')).toBeInTheDocument());
  });

  it('disables buttons while importing', async () => {
    let resolve!: () => void;
    onImport.mockReturnValue(new Promise<void>((r) => { resolve = r; }));
    render(<ImportUrlForm onImport={onImport} onCancel={onCancel} />);
    fireEvent.change(screen.getByPlaceholderText(/chatgpt.com\/share/i), {
      target: { value: VALID_URL },
    });
    fireEvent.submit(screen.getByRole('button', { name: /^import$/i }).closest('form')!);
    await waitFor(() => expect(screen.getByText('Importing...')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: /cancel/i })).toBeDisabled();
    resolve();
  });
});
