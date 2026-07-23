// ============================================================
// GuestUsageBadge.jsx
//
// Small pill shown only to anonymous (not logged-in) users —
// tells them how many of their 5 free requests remain. Starts
// from the value App.jsx fetched on load, then updates live via
// the "guest-requests-updated" event httpClient.js dispatches
// after every successful /ai/generate or /ai/chat call.
// ============================================================

import { useEffect, useState } from "react";

function GuestUsageBadge({ initialRemaining }) {
  const [remaining, setRemaining] = useState(initialRemaining);

  useEffect(() => {
    setRemaining(initialRemaining);
  }, [initialRemaining]);

  useEffect(() => {
    const handler = (e) => setRemaining(e.detail.remaining);
    window.addEventListener("guest-requests-updated", handler);
    return () => window.removeEventListener("guest-requests-updated", handler);
  }, []);

  if (remaining === null || remaining === undefined) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-20 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 backdrop-blur-md select-none"
      title="Free guest requests remaining"
    >
      <span className={remaining <= 1 ? "text-amber-300 font-medium" : ""}>
        {remaining}/5
      </span>{" "}
      free requests left
    </div>
  );
}

export default GuestUsageBadge;