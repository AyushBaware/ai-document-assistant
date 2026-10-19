// Purpose: Signs users in with Google and stores the app session.

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