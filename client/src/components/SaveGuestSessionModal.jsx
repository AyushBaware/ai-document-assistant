// ============================================================
// SaveGuestSessionModal.jsx
//
// Shown right after a successful login IF the person had an
// anonymous session in progress. Styled to match GuestLimitModal
// and ApiKeyModal so it reads as the same product, not a new UI.
// ============================================================

import { motion, AnimatePresence } from "framer-motion";
import { FiFileText } from "react-icons/fi";

function SaveGuestSessionModal({ documents = [], onSave, onDiscard, isSaving }) {
  const label =
    documents.length === 1
      ? documents[0].displayName || documents[0].fileName
      : `${documents.length} documents`;

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
              <FiFileText className="text-2xl text-cyan-400" />
            </div>
          </div>

          <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">
            Welcome back!
          </h2>

          <p className="text-gray-400 text-sm text-center leading-relaxed mb-6">
            You were working on <span className="text-white font-medium">{label}</span>{" "}
            before signing in. Save it to your account, or start fresh.
          </p>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={onDiscard}
              disabled={isSaving}
              className="cursor-pointer flex-1 py-2.5 rounded-xl border border-white/10 text-gray-300 text-sm font-medium hover:bg-white/5 transition-all disabled:opacity-50"
            >
              Start Fresh
            </button>
            <button
              onClick={onSave}
              disabled={isSaving}
              className="cursor-pointer flex-1 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save & Continue"}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default SaveGuestSessionModal;