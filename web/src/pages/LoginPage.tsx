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
  const [showPassword, setShowPassword] = useState(false);

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
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-gray-300 rounded px-2 py-1.5 pr-9 text-sm focus:outline-none focus:border-blue-400 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
                autoComplete="current-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
                className="absolute inset-y-0 right-0 flex items-center px-2 text-gray-400 hover:text-gray-600"
                tabIndex={-1}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
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
