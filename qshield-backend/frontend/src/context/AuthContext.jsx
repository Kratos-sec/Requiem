import { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { normalizeRole } from '../utils/roleAccess';

export const AuthContext = createContext();

const API = '';

// Access token lives in memory only (not localStorage) for security.
// Refresh token lives in localStorage — survives page reload, expires in 4 hours.
const REFRESH_INTERVAL_MS = 25 * 60 * 1000; // refresh access token every 25 min

function decodeJwtPayload(token) {
  try {
    if (!token || typeof token !== 'string' || token.split('.').length < 2) {
      return null;
    }
    const payload = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), '=');
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function buildUserFromToken(token) {
  const payload = decodeJwtPayload(token);
  if (!payload) {
    return null;
  }
  return {
    email: payload.sub || payload.email || '',
    role: normalizeRole(payload.role),
  };
}

export function AuthProvider({ children }) {
  const [accessToken, setAccessToken] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [isReady, setIsReady] = useState(false); // true after initial refresh attempt
  const refreshTimer = useRef(null);

  /** Attempt to get a new access token using the stored refresh token. */
  const silentRefresh = useCallback(async () => {
    const storedRefresh = localStorage.getItem('refresh_token');
    if (!storedRefresh) {
      setIsReady(true);
      return false;
    }
    try {
      const res = await fetch(`${API}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: storedRefresh }),
      });
      if (!res.ok) {
        // Refresh token expired or invalid — clear everything
        localStorage.removeItem('refresh_token');
        setAccessToken(null);
        setCurrentUser(null);
        setIsReady(true);
        return false;
      }
      const data = await res.json();
      setAccessToken(data.access_token);
      setCurrentUser(buildUserFromToken(data.access_token));
      // Rotate: save new refresh token
      localStorage.setItem('refresh_token', data.refresh_token);
      setIsReady(true);
      return true;
    } catch {
      setIsReady(true);
      return false;
    }
  }, []);

  /** Schedule a silent refresh every 25 minutes while logged in. */
  const scheduleRefresh = useCallback(() => {
    if (refreshTimer.current) clearInterval(refreshTimer.current);
    refreshTimer.current = setInterval(silentRefresh, REFRESH_INTERVAL_MS);
  }, [silentRefresh]);

  /** Called immediately after login / 2FA verify — stores both tokens. */
  const login = useCallback((newAccessToken, newRefreshToken) => {
    setAccessToken(newAccessToken);
    setCurrentUser(buildUserFromToken(newAccessToken));
    if (newRefreshToken) {
      localStorage.setItem('refresh_token', newRefreshToken);
    } else {
      localStorage.removeItem('refresh_token');
    }
    scheduleRefresh();
  }, [scheduleRefresh]);

  const logout = useCallback(() => {
    setAccessToken(null);
    setCurrentUser(null);
    localStorage.removeItem('refresh_token');
    if (refreshTimer.current) clearInterval(refreshTimer.current);
  }, []);

  // On mount: attempt silent refresh to restore session from refresh token
  useEffect(() => {
    silentRefresh().then((ok) => {
      if (ok) scheduleRefresh();
    });
    return () => {
      if (refreshTimer.current) clearInterval(refreshTimer.current);
    };
  }, [silentRefresh, scheduleRefresh]);

  return (
    <AuthContext.Provider value={{
      token: accessToken,        // short-lived access token (in memory)
      user: currentUser,
      role: currentUser?.role || null,
      login,
      logout,
      silentRefresh,
      isAuthenticated: !!accessToken,
      isReady,                   // false until initial restore attempt completes
    }}>
      {children}
    </AuthContext.Provider>
  );
}
