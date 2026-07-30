// ============================================================
// NotificationBell.jsx
//
// Only rendered for logged-in users (guests have no account to
// hold notifications against).
//
// DESKTOP: unchanged — full message inline, click text to mark
// read, hover reveals a trash icon to delete.
//
// MOBILE: a compact list (title + one-line preview + relative
// time, no inline "mark as read" text) — tapping a row opens
// NotificationDetailModal (auto-marks read) and closes this
// dropdown. Swiping a row left or right deletes it, instead of
// a tap target that would otherwise crowd a small screen.
// ============================================================

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiBell, FiTrash2 } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { getNotifications, markNotificationRead, deleteNotification } from "../api/notificationApi";
import NotificationDetailModal from "./NotificationDetailModal";
import { useHoverTooltip } from "../hooks/useHoverTooltip";

// Matches SessionHistory.jsx's own relative-time formatting exactly,
// for a consistent feel across the app's two notification-like lists.
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

const isTouchDevice = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: none)").matches;

const SWIPE_DELETE_THRESHOLD = 80;

function NotificationBell() {
  const { user, token } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailNotification, setDetailNotification] = useState(null);
  const isMobile = useRef(isTouchDevice());
  const { showTooltip, hideTooltip, tooltipPortal } = useHoverTooltip();

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

  useEffect(() => {
    loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (isOpen) loadNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleMarkRead = async (id) => {
    setNotifications((prev) =>
      prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
    );
    try {
      await markNotificationRead(id, token);
    } catch (err) {
      // Revert so the UI never lies about server state, and log the
      // real reason instead of failing silently.
      console.warn("Failed to mark notification as read:", err.message);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: false } : n))
      );
    }
  };

  const handleDelete = async (id) => {
    setNotifications((prev) => prev.filter((n) => n._id !== id));
    try {
      await deleteNotification(id, token);
    } catch {
      // Non-blocking — worst case it briefly reappears next reload.
    }
  };

  const handleOpenDetail = (n) => {
    setIsOpen(false);
    setDetailNotification(n);
    if (!n.isRead) handleMarkRead(n._id);
  };

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="cursor-pointer relative w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
        data-tooltip="Notifications"
        data-tooltip-pos="bottom"
        data-tooltip-align="end"
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
              className="absolute right-0 top-12 w-72 sm:w-80 max-w-[90vw] bg-white/[0.06] backdrop-blur-2xl border border-white/10 rounded-2xl p-3 shadow-xl z-30 max-h-96 overflow-y-auto"
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

              {/* ── MOBILE: compact, swipeable list ─────────────── */}
              {isMobile.current ? (
                <AnimatePresence initial={false}>
                  {notifications.map((n) => (
                    <motion.div
                      key={n._id}
                      layout
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.6}
                      whileDrag={{ scale: 0.98 }}
                      onDragEnd={(e, info) => {
                        if (Math.abs(info.offset.x) > SWIPE_DELETE_THRESHOLD) {
                          handleDelete(n._id);
                        }
                      }}
                      onClick={() => handleOpenDetail(n)}
                      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                      className="cursor-pointer active:bg-white/[0.04] rounded-xl px-2 py-2.5 border-b border-white/5 last:border-b-0"
                    >
                      <div className="flex items-center gap-2 mb-0.5">
                        {!n.isRead && (
                          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 shrink-0" />
                        )}
                        <p className="text-sm font-semibold text-white truncate flex-1">
                          {n.title}
                        </p>
                        <span className="text-[10px] text-gray-500 shrink-0">
                          {formatRelativeTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate pl-3.5">{n.message}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              ) : (
                /* ── DESKTOP: unchanged full-detail rows ───────── */
                notifications.map((n) => (
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
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(n._id);
                      }}
                      onMouseEnter={(e) => showTooltip(e, "Delete notification", { position: "bottom", align: "end" })}
                      onMouseLeave={hideTooltip}
                      className="cursor-pointer absolute top-2 right-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity w-7 h-7 rounded-lg flex items-center justify-center text-gray-500 hover:text-red-400 hover:bg-red-500/10 shrink-0"
                    >
                      <FiTrash2 className="text-sm" />
                    </button>
                  </div>
                ))
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <NotificationDetailModal
        notification={detailNotification}
        onClose={() => setDetailNotification(null)}
      />

      {tooltipPortal}
    </div>
  );
}

export default NotificationBell;