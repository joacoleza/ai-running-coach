import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface LoginPageProps {
  onTempPassword: () => void;
}

export function LoginPage({ onTempPassword }: LoginPageProps) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Autofocus email on mount
  useEffect(() => {
    document.getElementById('login-email')?.focus();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        const data = await response.json() as {
          token: string;
          refreshToken: string;
          expiresIn: number;
          tempPassword: boolean;
        };
        // Decode JWT payload to extract isAdmin flag (no signature verification needed — UI only)
        let isAdmin = false;
        try {
          const payload = JSON.parse(atob(data.token.split('.')[1])) as { isAdmin?: boolean };
          isAdmin = payload.isAdmin === true;
        } catch {
          // Malformed token — treat as non-admin; the API will reject it anyway
        }
        login(data.token, data.refreshToken, email, isAdmin, data.tempPassword);
        if (data.tempPassword) {
          onTempPassword();
        }
        // If tempPassword is false, App.tsx gate re-evaluates and shows AppShell
      } else if (response.status === 401) {
        setError('Invalid email or password');
        setPassword('');
      } else if (response.status === 429) {
        const data = await response.json() as { error?: string };
        setError(data.error || 'Account locked. Try again later.');
        setPassword('');
      } else if (response.status === 503) {
        setError('Service locked. Contact administrator.');
      } else {
        setError('Network error — please try again');
        setPassword('');
      }
    } catch {
      setError('Network error — please try again');
      setPassword('');
    } finally {
      setLoading(false);
    }
  }

  const isReady = email.trim().length > 0 && password.length > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white rounded-lg shadow-md p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-6">AI Running Coach</h1>
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="login-email" className="block text-xs font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              autoComplete="email"
            />
          </div>
          <div className="mb-4">
            <label htmlFor="login-password" className="block text-xs font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={loading}
              autoComplete="current-password"
            />
          </div>
          {error && (
            <p className="text-red-600 text-sm mt-2 mb-2">{error}</p>
          )}
          <button
            type="submit"
            disabled={loading || !isReady}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-medium py-2 px-4 rounded transition-colors disabled:cursor-not-allowed"
          >
            {loading ? 'Checking...' : 'Log In'}
          </button>
        </form>
      </div>
    </div>
  );
}
