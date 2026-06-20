// ============================================================
// AuthContext.jsx
//
// WHAT IS REACT CONTEXT?
// Normally in React, data flows down via props — parent to
// child. But auth state (is user logged in? who are they?) is
// needed in MANY components scattered across your app — the
// navbar, settings menu, future session history sidebar, etc.
// Passing it down as props through every layer would be messy
// ("prop drilling"). Context solves this: any component,
// anywhere in the tree, can directly read auth state without
// it being manually passed down through every parent.
//
// WHAT THIS FILE PROVIDES TO YOUR APP:
// - user            → current logged-in user's info, or null
// - token           → the JWT string, or null
// - isAuthLoading   → true while we're checking localStorage
//                     on initial app load
// - login(token, user) → call this after successful Google login
// - logout()        → clears everything, logs the user out
//
// HOW THIS WORKS WITH YOUR EXISTING geminiKey PATTERN:
// This follows the EXACT same localStorage pattern you already
// understand from Phase 1. Instead of "gemini_api_key" we now
// also store "app_jwt_token" and "app_user". Same mental model,
// just for a different piece of data.
// ============================================================

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