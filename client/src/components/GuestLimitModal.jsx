// ============================================================
// GuestLimitModal.jsx
//
// Full hard-block screen shown when an anonymous user's 6th
// request attempt is rejected by the backend (GUEST_LIMIT_REACHED).
// Styled to match ApiKeyModal so it reads as one coherent product
// moment rather than a jarring paywall.
//
// Renders its own LoginButton — App.jsx hides the top-right one
// while this modal is open, so only one GoogleLogin instance is
// ever mounted at a time (mounting two simultaneously triggers a
// harmless but noisy "initialize() called multiple times" SDK
// warning, which the app has intentionally avoided elsewhere).
// ============================================================

import { motion, AnimatePresence } from "framer-motion";
import { FiLock } from "react-icons/fi";
import LoginButton from "./LoginButton";

function GuestLimitModal({ onClose }) {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md bg-[#0d1117] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(0,255,255,0.08)]"
        >
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.15)]">
              <FiLock className="text-2xl text-cyan-400" />
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">
            You're All Out of Free Requests
          </h2>

          <p className="text-gray-400 text-sm text-center leading-relaxed mb-6">
            You've used all 5 free guest requests. Sign in with Google — it's
            free and takes a few seconds — to keep generating responses and
            start saving your document history.
          </p>

          <div className="flex justify-center mb-4">
            <LoginButton onLoginSuccess={onClose} />
          </div>

          <button
            onClick={onClose}
            className="cursor-pointer w-full py-2.5 rounded-xl text-gray-500 font-medium text-xs hover:text-gray-300 transition-all"
          >
            Maybe later
          </button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default GuestLimitModal;