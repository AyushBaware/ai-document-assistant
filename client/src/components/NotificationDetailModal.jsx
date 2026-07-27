// ============================================================
// NotificationDetailModal.jsx
//
// Mobile-only: shown when a notification is tapped in the
// compact list. Same visual language as ApiKeyModal/
// GuestLimitModal — centered card, blurred backdrop — so it
// reads as the same product, not a new UI pattern.
// ============================================================

import { motion, AnimatePresence } from "framer-motion";
import { FiBell } from "react-icons/fi";

function NotificationDetailModal({ notification, onClose }) {
  return (
    <AnimatePresence>
      {notification && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#0d1117] border border-white/10 rounded-3xl p-6 shadow-[0_0_60px_rgba(0,255,255,0.08)]"
          >
            <div className="flex justify-center mb-5">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shadow-[0_0_25px_rgba(34,211,238,0.15)]">
                <FiBell className="text-xl text-cyan-400" />
              </div>
            </div>

            <h3 className="text-lg font-bold text-white text-center mb-2">
              {notification.title}
            </h3>
            <p className="text-gray-400 text-sm text-center leading-relaxed mb-6">
              {notification.message}
            </p>

            <button
              onClick={onClose}
              className="cursor-pointer w-full py-2.5 rounded-xl bg-white/5 border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/10 transition-all"
            >
              Close
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default NotificationDetailModal;