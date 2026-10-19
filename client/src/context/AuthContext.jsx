// Purpose: Shares the signed-in user and auth actions across the client.

import { createContext, useContext, useState, useEffect } from "react";

const AuthContext = createContext(null);

// Custom hook — lets any component do: const { user, login } = useAuth()
export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // ── ON APP LOAD: check if user was already logged in ──────
  useEffect(() => {
    const savedToken = localStorage.getItem("app_jwt_token");
    const savedUser = localStorage.getItem("app_user");

    if (savedToken && savedUser) {
      try {
        setToken(savedToken);
        setUser(JSON.parse(savedUser));
      } catch {
        // Corrupted localStorage data — clear it safely
        localStorage.removeItem("app_jwt_token");
        localStorage.removeItem("app_user");
      }
    }

    setIsAuthLoading(false);
  }, []);

  // ── LOGIN: called after successful Google auth ─────────────
  const login = (newToken, newUser) => {
    localStorage.setItem("app_jwt_token", newToken);
    localStorage.setItem("app_user", JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  // ── LOGOUT: clears everything ───────────────────────────────
  const logout = () => {
    localStorage.removeItem("app_jwt_token");
    localStorage.removeItem("app_user");
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthLoading, login, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}