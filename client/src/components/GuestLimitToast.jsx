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
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 10 }}
          className="fixed bottom-16 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-20 rounded-2xl border border-cyan-400/20 bg-[#0d1117] px-4 py-3.5 shadow-xl flex items-start gap-3"
        >
          <FiZap className="text-cyan-400 text-lg shrink-0 mt-0.5" />
          <p className="text-xs text-gray-300 leading-relaxed flex-1">{message}</p>
          <button
            onClick={onDismiss}
            className="cursor-pointer text-gray-500 hover:text-white transition-colors shrink-0"
          >
            <FiX className="text-sm" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default GuestLimitToast;