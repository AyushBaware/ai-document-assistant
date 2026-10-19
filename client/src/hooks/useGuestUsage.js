// Purpose: Tracks guest request usage and limit notifications.

import { useState, useEffect, useCallback } from "react";

const TOAST_MESSAGES = { 
  1: "4/5 free credits used. Sign in to continue generating responses.", 
  0: "Out of free credits. Sign in to save documents and continue generating responses.", 
};

export function useGuestUsage(initialRemaining) {
  const [remaining, setRemaining] = useState(initialRemaining ?? null);
  const [toastMessage, setToastMessage] = useState(null);
  const [showLimitModal, setShowLimitModal] = useState(false);

  // Syncs once the initial /apikey/status fetch resolves (App.jsx
  // owns that single network call — this hook just consumes it).
  useEffect(() => {
    setRemaining(initialRemaining ?? null);
  }, [initialRemaining]);

  // Live updates — fire immediately after every successful anonymous
  // /ai/generate or /ai/chat call, or the moment the 6th is rejected.
  useEffect(() => {
    const handleUpdate = (e) => {
      const value = e.detail.remaining;
      setRemaining(value);
      if (value === 1 || value === 0) {
        setToastMessage(TOAST_MESSAGES[value]);
      }
    };
    const handleLimitReached = () => setShowLimitModal(true);

    window.addEventListener("guest-requests-updated", handleUpdate);
    window.addEventListener("guest-limit-reached", handleLimitReached);
    return () => {
      window.removeEventListener("guest-requests-updated", handleUpdate);
      window.removeEventListener("guest-limit-reached", handleLimitReached);
    };
  }, []);

  const dismissToast = useCallback(() => setToastMessage(null), []);
  const closeLimitModal = useCallback(() => setShowLimitModal(false), []);

  return { remaining, toastMessage, dismissToast, showLimitModal, closeLimitModal };
}