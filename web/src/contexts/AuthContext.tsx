import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface AuthState {
  token: string | null;
  email: string | null;
  isAdmin: boolean;
  tempPassword: boolean;
}

interface AuthContextValue extends AuthState {
  login: (token: string, refreshToken: string, email: string, isAdmin: boolean, tempPassword: boolean) => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readAuthFromStorage(): AuthState {
  return {
    token: localStorage.getItem('access_token'),
    email: localStorage.getItem('auth_email'),
    isAdmin: localStorage.getItem('auth_is_admin') === 'true',
    tempPassword: localStorage.getItem('auth_temp_password') === 'true',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>(readAuthFromStorage);

  const login = useCallback((token: string, refreshToken: string, email: string, isAdmin: boolean, tempPassword: boolean) => {
    localStorage.setItem('access_token', token);
    localStorage.setItem('refresh_token', refreshToken);
    localStorage.setItem('auth_email', email);
    localStorage.setItem('auth_is_admin', String(isAdmin));
    localStorage.setItem('auth_temp_password', String(tempPassword));
    setAuth({ token, email, isAdmin, tempPassword });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('auth_email');
    localStorage.removeItem('auth_is_admin');
    localStorage.removeItem('auth_temp_password');
    setAuth({ token: null, email: null, isAdmin: false, tempPassword: false });
  }, []);

  return (
    <AuthContext.Provider value={{ ...auth, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
