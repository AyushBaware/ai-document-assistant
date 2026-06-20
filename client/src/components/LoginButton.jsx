// ============================================================
// LoginButton.jsx
//
// WHAT THIS RENDERS:
// Google's official "Sign in with Google" button, using the
// @react-oauth/google library — this is Google's recommended
// way to integrate Google Identity Services in React.
//
// WHAT HAPPENS WHEN CLICKED:
// 1. Google shows its own popup/redirect login flow
// 2. User selects their Google account, approves
// 3. Google calls our onSuccess handler with a "credential"
//    (the signed ID token described in authController.js)
// 4. We send that credential to OUR backend (/api/auth/google)
// 5. Backend verifies it, returns OUR jwt + user info
// 6. We call login() from AuthContext to save the session
//
// WHY A SEPARATE COMPONENT?
// Keeps the Google-specific UI logic isolated. If you ever
// add GitHub or another OAuth provider later, it would live
// in its own component file the same way — clean separation.
// ============================================================

import { GoogleLogin } from "@react-oauth/google";
import { useAuth } from "../context/AuthContext";
import { verifyGoogleLogin } from "../api/authApi";
import { useState } from "react";

function LoginButton({ onLoginSuccess }) {
  const { login } = useAuth();
  const [error, setError] = useState("");

  const handleSuccess = async (credentialResponse) => {
    try {
      setError("");
      // credentialResponse.credential is Google's signed ID token
      const data = await verifyGoogleLogin(credentialResponse.credential);

      if (data.success) {
        login(data.token, data.user); // saves to AuthContext + localStorage
        if (onLoginSuccess) onLoginSuccess();
      }
    } catch (err) {
      console.error("Login failed:", err);
      setError("Login failed. Please try again.");
    }
  };

  const handleError = () => {
    setError("Google sign-in was cancelled or failed.");
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <GoogleLogin
        onSuccess={handleSuccess}
        onError={handleError}
        theme="filled_black"
        shape="pill"
        size="large"
        text="signin_with"
      />
      {error && (
        <p className="text-red-400 text-xs text-center">{error}</p>
      )}
    </div>
  );
}

export default LoginButton;