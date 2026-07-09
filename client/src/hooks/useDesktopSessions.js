import { useState, useEffect } from "react";
import { getAllSessions, deleteSession } from "../api/sessionApi";

// ============================================================
// useDesktopSessions.js
//
// Loads/deletes the session list shown in UploadBox's desktop
// sidebar (Claude/Gemini-style persistent history), reloading
// whenever the full-screen view becomes active.
// ============================================================
export function useDesktopSessions({ user, token, isFullScreenOpen }) {
  const [deskSessions, setDeskSessions] = useState([]);
  const [deskSessionsLoading, setDeskSessionsLoading] = useState(false);

  const loadDesktopSessions = async () => {
    if (!user || !token) return;
    try {
      setDeskSessionsLoading(true);
      const data = await getAllSessions(token);
      setDeskSessions(data.sessions);
    } catch {
      // Non-blocking — sidebar history is a convenience, not critical.
    } finally {
      setDeskSessionsLoading(false);
    }
  };

  useEffect(() => {
    if (isFullScreenOpen) {
      loadDesktopSessions();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFullScreenOpen]);

  const handleDeleteDeskSession = async (e, sessionId) => {
    e.stopPropagation();
    try {
      await deleteSession(sessionId, token);
      setDeskSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch {
      // Non-blocking.
    }
  };

  return { deskSessions, deskSessionsLoading, handleDeleteDeskSession };
}