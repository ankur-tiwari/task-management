import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../api/services';
import { setUnauthorizedHandler } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data } = await authService.me();
      setUser(data);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    refresh().finally(() => setLoading(false));
    setUnauthorizedHandler(() => setUser(null)); // expired/revoked session
  }, [refresh]);

  /** Returns { mfaToken } when a second factor is required, otherwise signs in. */
  const login = useCallback(async (credentials) => {
    const { data } = await authService.login(credentials);
    if (data.mfa_required) return { mfaToken: data.mfa_token };
    setUser(data.user);
    return {};
  }, []);

  const completeMfa = useCallback(async (mfaToken, code) => {
    const { data } = await authService.loginMfa({ mfa_token: mfaToken, code });
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    try { await authService.logout(); } finally { setUser(null); }
  }, []);

  const value = useMemo(
    () => ({ user, loading, login, completeMfa, logout, refresh }),
    [user, loading, login, completeMfa, logout, refresh],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
