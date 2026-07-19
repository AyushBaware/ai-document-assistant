// ============================================================
// App.jsx
//
// WHAT CHANGED FROM PHASE 2:
// 1. Imports SessionHistory — the sidebar showing past sessions
// 2. Tracks `selectedSessionId` — when set via sidebar click,
//    gets passed into UploadBox as `preloadedSession`
// 3. Tracks `sessionRefreshTrigger` — a simple counter bumped
//    every time a new session is saved, so SessionHistory
//    knows to reload its list (React doesn't auto-detect
//    changes happening inside a sibling component otherwise)
//
// Everything from Phase 1 (geminiKey) and Phase 2 (auth) is
// completely unchanged below — Phase 3 is purely additive.
// ============================================================

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import "./App.css";
import BackgroundGlow from "./components/BackgroundGlow";
import HeroSection from "./components/HeroSection";
import UploadBox from "./components/UploadBox";
import ApiKeyModal from "./components/ApiKeyModal";
import LoginButton from "./components/LoginButton";
import SessionHistory from "./components/SessionHistory";
import { useAuth } from "./context/AuthContext";
import { FiSettings, FiLogOut, FiUser } from "react-icons/fi";

function App() {
  // ── GEMINI API KEY STATE (Phase 1 — unchanged) ────────────
  const [geminiKey, setGeminiKey] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // ── AUTH STATE (Phase 2 — unchanged) ──────────────────────
  const { user, isAuthLoading, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  // ── SESSION HISTORY STATE (Phase 3 — new) ─────────────────
  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionRefreshTrigger, setSessionRefreshTrigger] = useState(0);

  // Hidden as soon as the user has files in play (uploading, processing,
  // or viewing a response) — no point burning screen space on the pitch
  // copy once they're actually using the tool, especially on mobile.
  const [hideHero, setHideHero] = useState(false);

  // True while the full-screen chat is open — hides history + settings
  // so the chat screen has zero competing chrome.
  const [hideChrome, setHideChrome] = useState(false);

  useEffect(() => {
    const savedKey = localStorage.getItem("gemini_api_key");
    setGeminiKey(savedKey || "");
  }, []);

  const handleKeySaved = (key) => {
    setGeminiKey(key);
    setShowSettings(false);
  };

  const handleClearKey = () => {
    localStorage.removeItem("gemini_api_key");
    setGeminiKey("");
    setShowSettings(false);
  };

  // Called by SessionHistory when user clicks a past session
  const handleSelectSession = (sessionId) => {
    setSelectedSessionId(sessionId);
  };

  // Called by UploadBox right after a NEW session is saved —
  // bumps the trigger so SessionHistory refreshes its list
  // next time it's opened.
  const handleSessionSaved = () => {
    setSessionRefreshTrigger((prev) => prev + 1);
  };

  if (geminiKey === null || isAuthLoading) return null;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`relative bg-[#030712] text-white ${
        hideHero
          ? "min-h-screen overflow-hidden"
          : "h-screen overflow-hidden flex flex-col"
      }`}
    >
      <BackgroundGlow />

      {/* ── SESSION HISTORY SIDEBAR (Phase 3) ─────────────────
          Renders nothing if user is not logged in — see the
          `if (!user) return null` check inside the component.
      ──────────────────────────────────────────────────────── */}
      {!hideChrome && (
        <SessionHistory
          onSelectSession={handleSelectSession}
          refreshTrigger={sessionRefreshTrigger}
          activeSessionId={selectedSessionId}
        />
      )}

      {/* ── TOP-RIGHT CONTROLS ─────────────────────────────── */}
      {!hideChrome && (
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">

        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="cursor-pointer flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
            >
              {user.picture ? (
                <img
                  src={user.picture}
                  alt={user.name}
                  className="w-7 h-7 rounded-full"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <FiUser className="w-7 h-7 p-1.5 rounded-full bg-cyan-500/20 text-cyan-300" />
              )}
              <span className="text-xs text-gray-300 hidden sm:inline pr-1">
                {user.name?.split(" ")[0]}
              </span>
            </button>

            {showUserMenu && (
              <>
                <div
                  onClick={() => setShowUserMenu(false)}
                  className="fixed inset-0 z-20"
                />
                <div className="absolute right-0 top-12 w-56 bg-[#0d1117] border border-white/10 rounded-2xl p-3 shadow-xl z-30">
                <p className="text-xs text-gray-400 px-1 mb-1">Signed in as</p>
                <p className="text-sm text-white px-1 mb-3 truncate">{user.email}</p>
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                    setSelectedSessionId(null); // clear any loaded session on logout
                  }}
                  className="cursor-pointer w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg bg-red-500/10 border border-red-400/20 text-red-300 hover:bg-red-500/20 transition"
                >
                  <FiLogOut className="text-sm" />
                  Sign Out
                </button>
              </div>
              </>
            )}
          </div>
        ) : (
          // SINGLE LoginButton instance — scaled down via CSS for
          // mobile instead of mounting a second component instance.
          // FIXED: previously this rendered twice (here + inline in
          // main content below), causing Google's SDK to call
          // initialize() twice — the "[GSI_LOGGER] initialize()
          // called multiple times" console warning.
          <div className="scale-[0.85] sm:scale-100 origin-right">
            <LoginButton />
          </div>
        )}

        <div className="relative">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="cursor-pointer w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            title="API Key Settings"
          >
            <FiSettings className="text-lg" />
          </button>

          {showSettings && (
            <>
              <div
                onClick={() => setShowSettings(false)}
                className="fixed inset-0 z-20"
              />
              <div className="absolute right-0 top-12 w-64 bg-[#0d1117] border border-white/10 rounded-2xl p-4 shadow-xl z-30">
              <p className="text-xs text-gray-400 mb-1">Gemini API Key</p>
              <p className="text-xs text-white font-mono truncate mb-3 bg-white/5 px-2 py-1.5 rounded-lg">
                {geminiKey
                  ? `${geminiKey.slice(0, 8)}${"•".repeat(20)}`
                  : "No key saved"}
              </p>
              <button
                onClick={() => {
                  setShowSettings(false);
                  setGeminiKey("");
                }}
                className="cursor-pointer w-full text-xs py-2 rounded-lg bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 hover:bg-cyan-500/20 transition mb-2"
              >
                Update API Key
              </button>
              <button
                onClick={handleClearKey}
                className="cursor-pointer w-full text-xs py-2 rounded-lg bg-red-500/10 border border-red-400/20 text-red-300 hover:bg-red-500/20 transition"
              >
                Remove Key
              </button>
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div
        className={`relative z-10 max-w-6xl mx-auto px-4 w-full transition-all duration-300 ${
          hideHero
            ? "pt-20 pb-6 sm:pt-24 sm:pb-8"
            : "flex-1 min-h-0 flex flex-col justify-center py-6 overflow-hidden"
        }`}
      >
        {!hideHero && <HeroSection />}

        {!hideHero && !user && (
          <p className="sm:hidden text-center text-gray-500 text-xs mb-6">
            Sign in (top right) to save your session history.
          </p>
        )}

        {geminiKey ? (
          <UploadBox
            geminiKey={geminiKey}
            preloadedSession={selectedSessionId}
            onSessionSaved={handleSessionSaved}
            onHeroVisibilityChange={setHideHero}
            onFullScreenChatChange={setHideChrome}
          />
        ) : null}
      </div>

      {geminiKey === "" && <ApiKeyModal onKeySaved={handleKeySaved} />}
    </motion.div>
  );
}

export default App;