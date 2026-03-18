import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('enm_token'));
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem('enm_refresh_token'));
  const [loading, setLoading] = useState(true);

  const logout = useCallback(async () => {
    try {
      const accessToken = localStorage.getItem('enm_access_token');
      await api.post('/auth/logout', { accessToken });
    } catch { /* best effort */ }
    localStorage.removeItem('enm_token');
    localStorage.removeItem('enm_access_token');
    localStorage.removeItem('enm_refresh_token');
    setToken(null);
    setRefreshToken(null);
    setUser(null);
  }, []);

  // Verify token on mount
  useEffect(() => {
    const verify = async () => {
      if (!token) { setLoading(false); return; }
      try {
        const res = await api.get('/auth/me');
        setUser(res.data.user);
      } catch (err) {
        // Try refresh if we have a refresh token
        if (refreshToken) {
          try {
            const res = await api.post('/auth/refresh', { refreshToken });
            const newToken = res.data.token;
            localStorage.setItem('enm_token', newToken);
            setToken(newToken);
            const meRes = await api.get('/auth/me');
            setUser(meRes.data.user);
          } catch {
            logout();
          }
        } else {
          logout();
        }
      } finally {
        setLoading(false);
      }
    };
    verify();
  }, []); // eslint-disable-line

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { token: t, accessToken, refreshToken: rt, user: u } = res.data;
    localStorage.setItem('enm_token', t);
    if (accessToken) localStorage.setItem('enm_access_token', accessToken);
    if (rt) localStorage.setItem('enm_refresh_token', rt);
    setToken(t);
    setRefreshToken(rt || null);
    setUser(u);
    return res.data;
  };

  const register = async (name, email, password) => {
    const res = await api.post('/auth/register', { name, email, password });
    // In dev mode, we get a token back immediately
    if (res.data.token) {
      const { token: t, user: u } = res.data;
      localStorage.setItem('enm_token', t);
      setToken(t);
      setUser(u);
    }
    return res.data; // caller checks requiresConfirmation
  };

  const confirmEmail = async (email, code) => {
    return api.post('/auth/confirm', { email, code });
  };

  return (
    <AuthContext.Provider value={{
      user, token, loading,
      login, register, logout, confirmEmail,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
