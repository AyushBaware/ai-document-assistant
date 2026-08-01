import axios from "axios";

// Single shared axios instance — reused TCP connection (keep-alive),
// one place to change the backend URL for prod vs dev, and one place
// to attach auth headers instead of repeating it in every api file.
const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
  withCredentials: true, // sends the httpOnly deviceId cookie with every request
});

// ── REQUEST INTERCEPTOR: always attach the auth token when present ────
// FIXED: generateAI, askQuestion, and uploadFiles (the FRESH-upload code
// paths) never attached the JWT, even for a fully logged-in user — only
// the *FromSession variants built the header manually. The backend's
// optionalAuth only sets req.userId if it sees this header, so a
// logged-in user hitting these specific endpoints was silently treated
// as an anonymous guest and subjected to the 5-request guest cap. That's
// why some already-signed-in users kept being shown "Sign in with
// Google" in a loop — signing in again changed nothing, since the token
// was never sent on that request in the first place. Attaching it here,
// once, for every outgoing request closes this for good.
//
// Uses AxiosHeaders' own .has()/.set() rather than direct property
// access — config.headers is an AxiosHeaders instance by the time a
// request interceptor runs, and those methods are the documented,
// case-insensitive way to check/set on it (bracket access on the raw
// instance isn't guaranteed stable across axios versions).
httpClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("app_jwt_token");
  if (!token) return config;

  const alreadySet =
    typeof config.headers?.has === "function"
      ? config.headers.has("Authorization")
      : !!(config.headers && config.headers.Authorization);

  if (!alreadySet) {
    if (typeof config.headers?.set === "function") {
      config.headers.set("Authorization", `Bearer ${token}`);
    } else {
      config.headers = { ...(config.headers || {}), Authorization: `Bearer ${token}` };
    }
  }

  return config;
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

    // Quota exhausted or the saved key itself is invalid/expired — both
    // mean "this key can't do any more work right now." Broadcast so
    // App.jsx can surface a banner offering to switch keys, instead of
    // the person only seeing a one-off inline error on whichever panel
    // happened to be open.
    const errCode = error.response?.data?.code;
    if (errCode === "QUOTA_EXCEEDED" || errCode === "INVALID_KEY") {
      window.dispatchEvent(
        new CustomEvent("gemini-key-issue", {
          detail: {
            code: errCode,
            message: error.response?.data?.message || "Your API key can't be used right now.",
          },
        })
      );
    }

    return Promise.reject(error);
  }
);

export const withAuth = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export default httpClient;