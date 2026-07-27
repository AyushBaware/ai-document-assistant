// ============================================================
// ApiKeyModal.jsx
//
// WHAT THIS IS:
// A modal (popup) that asks the user for their Gemini API key
// the first time they visit the app. Once saved, it lives in
// localStorage — the browser's built-in key-value storage.
//
// WHY localStorage AND NOT THE SERVER?
// The API key is sensitive — like a password. If we sent it
// to our server and stored it in MongoDB, we'd need to encrypt
// it, manage user accounts, etc. For now, keeping it in the
// browser is simpler AND more secure — it never leaves the
// user's device except when making an AI request.
//
// HOW IT WORKS:
// 1. App checks localStorage for "gemini_api_key" on load
// 2. If not found → show this modal
// 3. User pastes their key → we save it to localStorage
// 4. Modal closes, app works normally
// 5. Every AI request sends the key in the request header
//
// HOW TO GET A FREE KEY:
// aistudio.google.com → Sign in → Get API key → Copy
// It takes about 2 minutes and is completely free.
// ============================================================

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiKey, FiExternalLink, FiEye, FiEyeOff, FiCheck, FiZap } from "react-icons/fi";
import { saveApiKey } from "../api/apiKeyApi";

function ApiKeyModal({ onKeySaved, onKeyShared }) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [isValidating, setIsValidating] = useState(false);

  // ──────────────────────────────────────────────────
  // BASIC VALIDATION
  // Gemini API keys always start with "AIza" and are
  // 39 characters long. We check this before saving
  // so users don't paste the wrong thing by mistake.
  // ──────────────────────────────────────────────────
  const isValidKeyFormat = (key) => {
    return key.startsWith("AIza") && key.length >= 35;
  };

  const handleSave = async () => {
    const trimmed = apiKey.trim();

    if (!trimmed) {
      setError("Please enter your Gemini API key.");
      return;
    }

    if (!isValidKeyFormat(trimmed)) {
      setError(
        "This doesn't look like a valid Gemini API key. Keys start with 'AIza' and are ~39 characters."
      );
      return;
    }

    try {
      setIsValidating(true);
      setError("");
      // Encrypted and saved on the backend — never kept in the browser.
      const saveResult = await saveApiKey(trimmed);
      if (saveResult?.keyShared && onKeyShared) {
        // Fires BEFORE onKeySaved() below, since onKeySaved can cause
        // this modal to unmount immediately (geminiKey flips to
        // "configured") — the warning needs to live in the parent,
        // not as local state here.
        onKeyShared();
      }
      const status = await onKeySaved();

      // If the deviceId cookie didn't persist (browser blocking or
      // clearing cookies), the save technically worked but the app can
      // never find it again on the next request — say so plainly.
      if (status?.cookiesBlocked || status?.hasKey === false) {
        setError(
          "Your key was saved, but your browser is blocking cookies, so we can't remember it. Please allow cookies for this site and try again — or sign in, which isn't affected by this."
        );
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Couldn't save your key. Please try again."
      );
    } finally {
      setIsValidating(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") handleSave();
  };

  return (
    <AnimatePresence>
      {/* BACKDROP — dark overlay behind the modal */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      >
        {/* MODAL CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          className="w-full max-w-md bg-[#0d1117] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(0,255,255,0.08)]"
        >
          {/* ICON */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.15)]">
              <FiKey className="text-2xl text-cyan-400" />
            </div>
          </div>

          {/* HEADING */}
          <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-2">
            Enter Your Gemini API Key
          </h2>

          {/* EXPLANATION — tell the user exactly what's happening */}
          <p className="text-gray-400 text-sm text-center leading-relaxed mb-5">
            DocuMind AI uses Google Gemini to analyze your documents.
            Your key is <span className="text-white font-medium">encrypted and stored securely</span>.
          </p>

          {/* GUEST LIMIT DISCLOSURE — stated upfront, not as a
              surprise once the user hits the wall later. */}
          <div className="flex items-center gap-2.5 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.06] px-4 py-2.5 mb-6">
            <FiZap className="text-cyan-400 text-base shrink-0" />
            <p className="text-xs text-cyan-100 leading-snug text-left">
              <span className="font-semibold">5 free requests</span>, no sign-in needed —
              sign in anytime for unlimited access.
            </p>
          </div>

          {/* HOW TO GET KEY LINK */}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 text-cyan-400 text-sm hover:text-cyan-300 transition-colors mb-6 group"
          >
            <FiExternalLink className="text-base group-hover:translate-x-0.5 transition-transform" />
            Get a free API key at aistudio.google.com
          </a>

          {/* INPUT */}
          <div className="relative mb-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => {
                setApiKey(e.target.value);
                setError(""); // Clear error on type
              }}
              onKeyDown={handleKeyDown}
              placeholder="AIza..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/8 transition-all font-mono"
            />
            {/* SHOW/HIDE KEY TOGGLE */}
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
            >
              {showKey ? <FiEyeOff className="text-base" /> : <FiEye className="text-base" />}
            </button>
          </div>

          {/* ERROR MESSAGE */}
          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="text-red-400 text-xs mt-2 mb-3 px-1"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {/* SAVE BUTTON */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSave}
            disabled={isValidating}
            className="cursor-pointer w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-semibold text-sm hover:opacity-90 transition-all shadow-[0_0_20px_rgba(34,211,238,0.25)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <FiCheck className="text-base" />
            {isValidating ? "Saving..." : "Save & Continue"}
          </motion.button>

          {/* PRIVACY NOTE */}
          <p className="text-gray-600 text-xs text-center mt-4 leading-relaxed">
            🔒 Encrypted at rest and never shared with third parties.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

export default ApiKeyModal;