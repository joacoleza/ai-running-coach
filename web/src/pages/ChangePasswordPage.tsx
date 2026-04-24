import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

function EyeIcon({ visible }: { visible: boolean }) {
  if (visible) {
    return (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    );
  }
  return (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

export function ChangePasswordPage() {
  const { login, logout, email, isAdmin } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Real-time validation: show mismatch error only after both fields have content
  const bothFilled = newPassword.length > 0 && confirmPassword.length > 0;
  const mismatch = bothFilled && newPassword !== confirmPassword;
  const tooShort = newPassword.length > 0 && newPassword.length < 8;

  const isReady = bothFilled && !mismatch && !tooShort;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isReady) return;

    setLoading(true);
    setError(null);

    try {
      const storedRefreshToken = localStorage.getItem('refresh_token');
      if (!storedRefreshToken) {
        logout();
        return;
      }

      // Authenticate via refresh token — avoids JWT signature issues across Azure instances
      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword, refreshToken: storedRefreshToken }),
      });

      if (response.ok) {
        // Server returns a fresh access token — use it to clear the tempPassword flag
        const data = await response.json() as { token: string; refreshToken: string };
        login(data.token, data.refreshToken, email ?? '', isAdmin, false);
      } else if (response.status === 401) {
        logout();
      } else if (response.status === 400) {
        const data = await response.json() as { error?: string };
        setError(data.error ?? 'Invalid request');
      } else {
        setError('Network error — please try again');
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-2">AI Running Coach</h1>
        <h2 className="text-lg font-semibold text-gray-700 mb-6">Change Your Password</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="new-password" className="block text-xs font-medium text-gray-700 mb-1">
              New Password
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 pr-9 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
                autoFocus
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowNew(prev => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                <EyeIcon visible={showNew} />
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
            {tooShort && (
              <p className="text-red-600 text-sm mt-1">Password must be at least 8 characters</p>
            )}
          </div>
          <div className="mb-4">
            <label htmlFor="confirm-password" className="block text-xs font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 pr-9 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(prev => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                <EyeIcon visible={showConfirm} />
              </button>
            </div>
            {mismatch && (
              <p className="text-red-600 text-sm mt-1">Passwords do not match</p>
            )}
          </div>
          {error && (
            <p className="text-red-600 text-sm mt-2 mb-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !isReady}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium py-2 px-4 rounded transition-colors disabled:cursor-not-allowed"
          >
            {loading ? 'Saving...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
}
