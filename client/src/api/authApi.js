// ============================================================
// authApi.js
//
// Same pattern as your existing aiApi.js and uploadApi.js —
// a thin wrapper around axios calls to your backend.
//
// OPTIMIZED: uses the shared httpClient instance instead of
// raw axios + a hardcoded base URL.
// ============================================================

import httpClient, { withAuth } from "./httpClient";

// Sends Google's ID token to our backend for verification.
// Backend returns our own JWT + user profile info.
export const verifyGoogleLogin = async (credential) => {
  const response = await httpClient.post("/auth/google", { credential });
  return response.data;
};

// Checks if a saved JWT is still valid — used to silently
// confirm login state on app reload, or detect expired sessions.
export const fetchCurrentUser = async (token) => {
  const response = await httpClient.get("/auth/me", withAuth(token));
  return response.data;
};