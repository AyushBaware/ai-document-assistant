// ============================================================
// GuestLimitToast.jsx
//
// Purely presentational + its own auto-dismiss timer. Message
// content and dismiss logic now come from useGuestUsage.js.
// ============================================================

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiZap } from "react-icons/fi";

const AUTO_DISMISS_MS = 8000;

function GuestLimitToast({ message, onDismiss }) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="fixed bottom-16 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-md z-20 rounded-2xl border border-cyan-400/20 bg-[#0d1117] px-5 py-4 shadow-2xl shadow-black/50 flex items-center gap-3.5"
        >
          <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shrink-0">
            <FiZap className="text-cyan-400 text-base" />
          </div>
          <p className="text-sm text-gray-200 leading-snug flex-1">{message}</p>
          <button
            onClick={onDismiss}
            className="cursor-pointer text-gray-500 hover:text-white transition-colors shrink-0 p-1"
          >
            <FiX className="text-base" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GuestLimitToast;