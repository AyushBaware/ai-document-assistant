// ============================================================
// main.jsx
//
// FIXED: GOOGLE_CLIENT_ID now reads from .env instead of being
// hardcoded. This is the correct pattern — hardcoding config
// values directly in code means changing environments (local
// vs production) requires editing source code, which is messy
// and risky (you could accidentally commit the wrong value).
//
// HOW VITE ENV VARIABLES WORK (different from Node's backend):
// - Backend (Node/Express): process.env.ANYTHING works directly
// - Frontend (Vite/React): variables MUST be prefixed with
//   VITE_ and accessed via import.meta.env.VITE_ANYTHING
// This prefix requirement is a Vite SECURITY feature — it
// prevents you from accidentally exposing backend secrets
// (like JWT_SECRET) to the browser. Only variables explicitly
// marked with VITE_ get bundled into the frontend code.
// ============================================================

import { createRoot } from "react-dom/client";
import { GoogleOAuthProvider } from "@react-oauth/google";
import "./index.css";
import App from "./App.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";

// Reads from client/.env — see .env.example for what to add
const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

createRoot(document.getElementById("root")).render(
  <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
    <AuthProvider>
      <App />
    </AuthProvider>
  </GoogleOAuthProvider>,
);
