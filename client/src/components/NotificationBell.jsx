// ============================================================
// NotificationBell.jsx
//
// Only rendered for logged-in users (guests have no account to
// hold notifications against) — matches SessionHistory.jsx's
// existing "return null if no user" pattern.
//
// Currently the only notification type is SECURITY_ALERT, fired
// when a Gemini API key fingerprint collision is detected (see
// apiKeyController.js saveApiKey()).
// ============================================================

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiBell, FiTrash2 } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { getNotifications, markNotificationRead, deleteNotification } from "../api/notificationApi";

function NotificationBell() {
  const { user, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const loadNotifications = async () => {
    if (!user || !token) return;
    try {
      setLoading(true);
      const data = await getNotifications(token);
      setNotifications(data.notifications || []);
    } catch {
      // Non-blocking — the bell is a convenience, not critical.
    } finally {
      setLoading(false);
    }
  };

  // Load once on login, and refresh every time the dropdown opens.
  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (isOpen) loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  {notifications.map((n) => (
                <div
                  key={n._id}
                  className={`group relative p-3 pr-10 rounded-xl mb-1.5 transition-all border ${
                    n.isRead
                      ? "border-transparent bg-white/[0.02]"
                      : "border-cyan-400/20 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.1]"
                  }`}
                >
                  <div
                    onClick={() => !n.isRead && handleMarkRead(n._id)}
                    className={!n.isRead ? "cursor-pointer" : ""}
                  >
                    <p className="text-sm font-semibold text-white mb-0.5 pr-1 break-words">
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-400 leading-snug break-words">
                      {n.message}
                    </p>
                    {!n.isRead && (
                      <span className="inline-block mt-1.5 text-[10px] text-cyan-300">
                        Tap to mark as read
                      </span>
                    )}
                  </div>
                  <button
                    onClick={(e) => handleDelete(e, n._id)}
                    className="cursor-pointer absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                    title="Delete notification"
                  >
                    <FiTrash2 className="text-sm" />
                  </button>
                </div>
              ))}

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="cursor-pointer relative w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        title="Notifications"
      >
        <FiBell className="text-lg" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div onClick={() => setIsOpen(false)} className="fixed inset-0 z-20" />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-12 w-72 sm:w-80 max-w-[90vw] bg-[#0d1117] border border-white/10 rounded-2xl p-3 shadow-xl z-30 max-h-96 overflow-y-auto"
            >
              <p className="text-xs font-medium text-gray-400 px-2 mb-2">Notifications</p>

              {loading && (
                <p className="text-xs text-gray-600 px-2 py-4 text-center">Loading...</p>
              )}

              {!loading && notifications.length === 0 && (
                <p className="text-xs text-gray-600 px-2 py-4 text-center">
                  No notifications yet.
                </p>
              )}

              {notifications.map((n) => (
                <div
                  key={n._id}
                  onClick={() => !n.isRead && handleMarkRead(n._id)}
                  className={`p-3 rounded-xl mb-1.5 cursor-pointer transition-all border ${
                    n.isRead
                      ? "border-transparent bg-white/[0.02]"
                      : "border-cyan-400/20 bg-cyan-500/[0.06] hover:bg-cyan-500/[0.1]"
                  }`}
                >
                  <p className="text-sm font-semibold text-white mb-0.5">{n.title}</p>
                  <p className="text-xs text-gray-400 leading-snug">{n.message}</p>
                  {!n.isRead && (
                    <span className="inline-block mt-1.5 text-[10px] text-cyan-300">
                      Tap to mark as read
                    </span>
                  )}
                </div>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default NotificationBell;