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

import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiKey,
  FiExternalLink,
  FiEye,
  FiEyeOff,
  FiCheck,
  FiZap,
  FiHelpCircle,
} from "react-icons/fi";
import { saveApiKey } from "../api/apiKeyApi";

const isTouchDevice = () =>
  typeof window !== "undefined" && window.matchMedia("(hover: none)").matches;

function ApiKeyModal({
  onKeySaved,
  onKeyShared,
  dismissible = false,
  onDismiss,
}) {
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [showSteps, setShowSteps] = useState(false);
  const isTouch = useRef(isTouchDevice());

  // ──────────────────────────────────────────────────
  // BASIC VALIDATION (format only — instant, no network call)
  // Google currently issues Gemini API keys in TWO formats:
  //   - Legacy "Traffic Keys":  AIzaSy... (39 chars)
  //   - Newer "Auth Keys":      AQ.Ab8...  (dot-separated)
  // This only rules out obviously-wrong pastes (empty, wrong
  // prefix, stray whitespace/characters). The REAL check — does
  // this key actually work — happens on the backend via a live
  // call to Gemini, right before saving. See handleSave() below.
  // ──────────────────────────────────────────────────
  const KEY_FORMAT_REGEX = /^(AIzaSy|AQ\.)[A-Za-z0-9_-]+$/;
  const isValidKeyFormat = (key) => KEY_FORMAT_REGEX.test(key);

  const handleSave = async () => {
    const trimmed = apiKey.trim();

    if (!trimmed) {
      setError("Please enter your Gemini API key.");
      return;
    }

    if (!isValidKeyFormat(trimmed)) {
      setError(
        "This doesn't look like a valid Gemini API key. Keys start with 'AIzaSy' or 'AQ.'.",
      );
      return;
    }

    try {
      setIsValidating(true);
      setError("");
      // Backend runs a real, live check against Google before saving —
      // catches typos/fake keys that merely LOOK right, not just
      // format mismatches. Encrypted and saved server-side — the
      // raw key never stays in the browser.
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
          "Your key was saved, but your browser is blocking cookies, so we can't remember it. Please allow cookies for this site and try again — or sign in, which isn't affected by this.",
        );
      }
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Couldn't save your key. Please try again.",
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
        // Only clickable when dismissible=true (the "Update Key" flow,
        // where an existing valid key is still saved on the backend).
        // In the "Remove Key" flow, dismissible is false — there is
        // genuinely no key anymore, so clicking outside must do nothing.
        onClick={dismissible ? onDismiss : undefined}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      >
        {/* MODAL CARD */}
        <motion.div
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.92, y: 20 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
          onClick={(e) => e.stopPropagation()} // clicks inside the card must never bubble up and trigger dismiss
          className="w-full max-w-md bg-[#0d1117] border border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_0_60px_rgba(0,255,255,0.08)]"
        >
          {/* ICON */}
          <div className="flex justify-center mb-6">
            <div className="w-14 h-14 rounded-2xl bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shadow-[0_0_30px_rgba(34,211,238,0.15)]">
              <FiKey className="text-2xl text-cyan-400" />
            </div>
          </div>

          {/* HEADING */}
          <h2 className="text-xl sm:text-2xl font-bold text-white text-center mb-1.5 tracking-tight">
            Enter Your Gemini API Key
          </h2>

          {/* EXPLANATION */}
          <p className="text-gray-400 text-sm text-center leading-relaxed mb-6 px-2">
            Powers DocuMind AI's document analysis —{" "}
            <span className="text-white font-medium">free from Google</span>,
            takes under a minute to set up.
          </p>

          {/* GET FREE KEY CTA */}
          <a
            href="https://aistudio.google.com/apikey"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-white text-sm font-semibold hover:opacity-90 transition-all shadow-[0_0_20px_rgba(34,211,238,0.2)] group"
          >
            <FiExternalLink className="text-base group-hover:translate-x-0.5 transition-transform" />
            Get Free API Key
          </a>

          {/* QUICK-HELP — centered, out of the way, same row rhythm as the CTA above */}
          <div className="relative flex justify-center mt-2.5 mb-6">
            <button
              type="button"
              onMouseEnter={!isTouch.current ? () => setShowSteps(true) : undefined}
              onMouseLeave={!isTouch.current ? () => setShowSteps(false) : undefined}
              onClick={() => isTouch.current && setShowSteps((v) => !v)}
              className="cursor-pointer flex items-center gap-1.5 text-xs text-gray-500 hover:text-cyan-300 transition-colors"
            >
              <FiHelpCircle className="text-sm" />
              Need help getting one?
            </button>

            <AnimatePresence>
              {showSteps && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-2 w-72 max-w-[85vw] rounded-xl border border-white/10 bg-[#12161f] p-4 shadow-[0_8px_24px_rgba(0,0,0,0.4)] z-10 text-left"
                >
                  <p className="text-[11px] font-semibold text-gray-400 mb-2.5 tracking-wide uppercase">
                    How to get your key
                  </p>
                  <ol className="space-y-2 text-xs text-gray-300">
                    <li className="flex gap-2">
                      <span className="text-cyan-400 font-semibold shrink-0">1.</span>
                      Click <span className="text-cyan-300 font-medium">Get Free API Key</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-cyan-400 font-semibold shrink-0">2.</span>
                      Sign in with your Google account
                    </li>
                    <li className="flex gap-2">
                      <span className="text-cyan-400 font-semibold shrink-0">3.</span>
                      Click <span className="text-cyan-300 font-medium">Create API key</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-cyan-400 font-semibold shrink-0">4.</span>
                      Copy it and paste it below
                    </li>
                  </ol>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* GUEST LIMIT DISCLOSURE */}
          <div className="flex items-center gap-2.5 rounded-xl border border-cyan-400/20 bg-cyan-500/[0.06] px-4 py-2.5 mb-6">
            <FiZap className="text-cyan-400 text-base shrink-0" />
            <p className="text-xs text-cyan-100 leading-snug text-left">
              <span className="font-semibold">5 free requests</span> without an
              account — sign in anytime for unlimited access.
            </p>
          </div>

          {/* INPUT */}
          <div className="relative mb-2">
            <input
              type={showKey ? "text" : "password"}
              value={apiKey}
              onChange={(e) => {a
                setApiKey(e.target.value);
                setError(""); // Clear error on type
              }}
              onKeyDown={handleKeyDown}
              placeholder="AIzaSy... or AQ.Ab8..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pr-12 text-white text-sm placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 focus:bg-white/8 transition-all font-mono"
            />
            {/* SHOW/HIDE KEY TOGGLE */}
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="cursor-pointer absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors p-1"
            >
              {showKey ? (
                <FiEyeOff className="text-base" />
              ) : (
                <FiEye className="text-base" />
              )}
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
