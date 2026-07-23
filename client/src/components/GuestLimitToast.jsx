// ============================================================
// GuestLimitToast.jsx
//
// Dismissible, auto-fading nudge shown to anonymous users after
// their 4th and 5th free request — non-blocking, they can keep
// using their last request(s). Listens for the same
// "guest-requests-updated" event the usage badge does.
// ============================================================

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiX, FiZap } from "react-icons/fi";

const AUTO_DISMISS_MS = 8000;

function GuestLimitToast() {
  const [message, setMessage] = useState(null);

  useEffect(() => {
    const handler = (e) => {
      const { remaining } = e.detail;
      if (remaining === 1) {
        setMessage(
          "You've used 4 of 5 free guest credits. Create a free account to save this document and unlock unlimited chats."
        );
      } else if (remaining === 0) {
        setMessage(
          "That was your last free guest request. Sign in above to keep generating responses."
        );
      }
    };
    window.addEventListener("guest-requests-updated", handler);
    return () => window.removeEventListener("guest-requests-updated", handler);
  }, []);

  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [message]);

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
            onClick={() => setMessage(null)}
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