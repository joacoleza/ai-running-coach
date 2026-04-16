import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

export function ChangePasswordPage() {
  const { token, login, logout, email, isAdmin } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

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
      // Proactively refresh the access token before the change-password request.
      // This guarantees a fresh token without relying on the 401 interceptor,
      // which can fail to refresh during this specific flow in production.
      let activeToken: string = localStorage.getItem('access_token') ?? token ?? '';
      const storedRefreshToken = localStorage.getItem('refresh_token');
      if (storedRefreshToken) {
        try {
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken: storedRefreshToken }),
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json() as { token: string };
            activeToken = refreshData.token;
            localStorage.setItem('access_token', activeToken);
          }
        } catch {
          // Refresh failed — proceed with the existing token (may still be valid)
        }
      }

      const response = await fetch('/api/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${activeToken}`,
        },
        body: JSON.stringify({ newPassword }),
      });

      if (response.ok) {
        // Clear tempPassword flag so App.tsx gate renders AppShell
        const freshRefreshToken = localStorage.getItem('refresh_token') ?? '';
        const freshToken = localStorage.getItem('access_token') ?? activeToken;
        login(freshToken, freshRefreshToken, email ?? '', isAdmin, false);
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
            <input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              autoFocus
              autoComplete="new-password"
            />
            <p className="text-xs text-gray-500 mt-1">Minimum 8 characters</p>
            {tooShort && (
              <p className="text-red-600 text-sm mt-1">Password must be at least 8 characters</p>
            )}
          </div>
          <div className="mb-4">
            <label htmlFor="confirm-password" className="block text-xs font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              autoComplete="new-password"
            />
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
