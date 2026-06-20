// ============================================================
// SessionHistory.jsx
//
// WHAT THIS IS:
// A slide-out sidebar showing the logged-in user's past
// sessions — exactly like Claude's chat history panel. Click
// a session, it loads instantly from MongoDB without calling
// Gemini again (zero tokens used to REVIEW past work).
//
// WHY THIS ONLY SHOWS WHEN LOGGED IN:
// Sessions belong to a userId. An anonymous user has no
// sessions to show — this component simply isn't rendered
// at all if `user` is null (handled in App.jsx).
//
// HOW OPENING A SESSION WORKS:
// onSelectSession is a callback passed down from App.jsx. When
// clicked, it calls getSessionById(), then hands the full
// session data back up to App.jsx, which passes it into
// UploadBox as "preloaded" data — UploadBox renders it exactly
// like a fresh upload, just without needing to re-upload files
// or re-call Gemini.
// ============================================================

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiClock, FiTrash2, FiX, FiMenu } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { getAllSessions, deleteSession } from "../api/sessionApi";

const formatRelativeTime = (dateString) => {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateString).toLocaleDateString();
};

function SessionHistory({ onSelectSession, refreshTrigger }) {
  const { user, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Reload sessions whenever the panel opens, or when
  // refreshTrigger changes (bumped by App.jsx after a new
  // session is saved — keeps the list current).
  useEffect(() => {
    if (isOpen && user && token) {
      loadSessions();
    }
  }, [isOpen, refreshTrigger]);

  const loadSessions = async () => {
    try {
      setLoading(true);
      setError("");
      const data = await getAllSessions(token);
      setSessions(data.sessions);
    } catch (err) {
      setError("Failed to load history.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (e, sessionId) => {
    e.stopPropagation(); // prevent triggering onSelectSession
    try {
      await deleteSession(sessionId, token);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (err) {
      setError("Failed to delete session.");
    }
  };

  const handleSelect = (sessionId) => {
    onSelectSession(sessionId);
    setIsOpen(false);
  };

  // Don't render anything for anonymous users — no sessions exist
  if (!user) return null;

  return (
    <>
      {/* TOGGLE BUTTON */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed top-4 left-4 z-20 w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        title="View History"
      >
        <FiClock className="text-lg" />
      </button>

      {/* SIDEBAR PANEL */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* BACKDROP */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30"
            />

            {/* PANEL */}
            <motion.div
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "tween", duration: 0.3, ease: "easeOut" }}
              className="fixed top-0 left-0 h-full w-[85vw] max-w-sm bg-[#0a0e16] border-r border-white/10 z-40 flex flex-col"
            >
              {/* HEADER */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <FiClock className="text-cyan-400" />
                  History
                </h2>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                >
                  <FiX />
                </button>
              </div>

              {/* SESSION LIST */}
              <div className="flex-1 overflow-y-auto px-3 py-3">
                {loading && (
                  <div className="flex justify-center py-10">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      className="w-6 h-6 rounded-full border-2 border-cyan-500/20 border-t-cyan-400"
                    />
                  </div>
                )}

                {error && (
                  <p className="text-red-400 text-sm text-center py-4">{error}</p>
                )}

                {!loading && sessions.length === 0 && !error && (
                  <p className="text-gray-500 text-sm text-center py-10 px-4">
                    No saved sessions yet. Upload a document and generate a response to start building your history.
                  </p>
                )}

                {sessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => handleSelect(session.id)}
                    className="w-full text-left p-3 rounded-xl hover:bg-white/[0.06] transition-all group mb-1.5 border border-transparent hover:border-white/10"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white font-medium truncate">
                          {session.title}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatRelativeTime(session.lastOpenedAt)} ·{" "}
                          {session.documentNames.length} file
                          {session.documentNames.length > 1 ? "s" : ""}
                        </p>
                        {/* Show which modes have cached responses */}
                        <div className="flex gap-1.5 mt-2">
                          {session.hasResponses.summary && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-400/20">
                              Summary
                            </span>
                          )}
                          {session.hasResponses.notes && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-400/20">
                              Notes
                            </span>
                          )}
                          {session.hasResponses.explain && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-pink-500/10 text-pink-300 border border-pink-400/20">
                              Explain
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={(e) => handleDelete(e, session.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                        title="Delete session"
                      >
                        <FiTrash2 className="text-sm" />
                      </button>
                    </div>
                  </button>
                ))}
              </div>

              {/* FOOTER NOTE */}
              <div className="px-5 py-3 border-t border-white/10">
                <p className="text-[11px] text-gray-600 text-center">
                  Up to 20 sessions are kept. Oldest are removed automatically.
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

export default SessionHistory;