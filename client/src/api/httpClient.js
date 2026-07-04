import axios from "axios";

// Single shared axios instance — reused TCP connection (keep-alive),
// one place to change the backend URL for prod vs dev, and one place
// to attach auth headers instead of repeating it in every api file.
const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
});

// SELF-HEALING AUTH: if the backend ever rejects our token with
// 401, that token is dead (expired, secret rotated after a server
// restart, or the user was deleted). Without this, every
// authenticated call (save session, load history) would keep
// silently failing forever with the UI still showing "logged in."
// Clearing the stored token and reloading drops the app back to
// its normal logged-out state, so the user just sees the Login
// button again and can sign back in — no confusing silent failures.
httpClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const isAuthError = error.response?.status === 401;
    const hadToken = !!localStorage.getItem("app_jwt_token");

    if (isAuthError && hadToken) {
      localStorage.removeItem("app_jwt_token");
      localStorage.removeItem("app_user");
      window.location.reload();
    }

    return Promise.reject(error);
  }
);

export const withAuth = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export default httpClient;