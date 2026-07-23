import axios from "axios";

// Single shared axios instance — reused TCP connection (keep-alive),
// one place to change the backend URL for prod vs dev, and one place
// to attach auth headers instead of repeating it in every api file.
const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: true, // sends the httpOnly deviceId cookie with every request
});

// SELF-HEALING AUTH + GUEST USAGE TRACKING:
// One shared response interceptor handles two unrelated concerns
// that both need to observe every response:
//
// 1. Auth healing (unchanged) — a dead 401 token clears itself.
//
// 2. Guest request tracking — the backend attaches
//    "X-Guest-Requests-Remaining" to successful anonymous
//    /ai/generate and /ai/chat calls, and returns a distinct
//    "GUEST_LIMIT_REACHED" code once the free cap is hit. Both
//    are broadcast as plain browser events so any component
//    (the usage badge, the limit-reached modal) can react
//    without this file needing to know about React at all.
httpClient.interceptors.response.use(
  (response) => {
    const remaining = response.headers?.["x-guest-requests-remaining"];
    if (remaining !== undefined) {
      window.dispatchEvent(
        new CustomEvent("guest-requests-updated", {
          detail: { remaining: Number(remaining) },
        })
      );
    }
    return response;
  },
  (error) => {
    const isAuthError = error.response?.status === 401;
    const hadToken = !!localStorage.getItem("app_jwt_token");

    if (isAuthError && hadToken) {
      localStorage.removeItem("app_jwt_token");
      localStorage.removeItem("app_user");
      window.location.reload();
    }

    if (error.response?.data?.code === "GUEST_LIMIT_REACHED") {
      window.dispatchEvent(new CustomEvent("guest-limit-reached"));
    }

    return Promise.reject(error);
  }
);

export const withAuth = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export default httpClient;