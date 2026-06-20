// ============================================================
// App.jsx
//
// WHAT THIS FILE NOW HANDLES:
// 1. Gemini API key (Phase 1 — unchanged logic, still required
//    to use the app, still stored in localStorage)
// 2. Google Login (Phase 2 — NEW, completely OPTIONAL)
//
// WHY LOGIN IS OPTIONAL HERE:
// Per your decision — the app must work fully without login.
// Login only matters for FUTURE features (saved history). So
// we show a small, dismissible login prompt rather than a
// blocking modal. The user can close it and keep using the
// app as before.
//
// HOW THE TWO SYSTEMS COEXIST:
// - geminiKey check still gates the main UploadBox (same as
//   before — you NEED a Gemini key to generate AI responses)
// - Google login is independent — it does NOT block anything
//   right now. It just shows a "Sign in" option in the corner.
//   When Phase 3 (session history) is built, THAT feature will
//   check `user` from AuthContext to decide what to show.
// ============================================================

import { useState, useEffect } from "react";
import "./App.css";
import BackgroundGlow from "./components/BackgroundGlow";
import HeroSection from "./components/HeroSection";
import UploadBox from "./components/UploadBox";
import ApiKeyModal from "./components/ApiKeyModal";
import LoginButton from "./components/LoginButton";
import { useAuth } from "./context/AuthContext";
import { FiSettings, FiLogOut, FiUser } from "react-icons/fi";

function App() {
  // ── GEMINI API KEY STATE (Phase 1 — unchanged) ────────────
  const [geminiKey, setGeminiKey] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // ── AUTH STATE (Phase 2 — new) ────────────────────────────
  const { user, isAuthLoading, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

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

  // Wait until BOTH localStorage checks finish before rendering,
  // to avoid a flash of the wrong UI state.
  if (geminiKey === null || isAuthLoading) return null;

  return (
    <div className="relative min-h-screen bg-[#030712] overflow-hidden text-white">
      <BackgroundGlow />

      {/* ── TOP-RIGHT CONTROLS ─────────────────────────────── */}
      <div className="absolute top-4 right-4 z-20 flex items-center gap-2">

        {/* ── AUTH SECTION — shows login button OR user avatar ── */}
        {user ? (
          <div className="relative">
            <button
              onClick={() => setShowUserMenu((v) => !v)}
              className="flex items-center gap-2 px-2 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
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
              <div className="absolute right-0 top-12 w-56 bg-[#0d1117] border border-white/10 rounded-2xl p-3 shadow-xl z-30">
                <p className="text-xs text-gray-400 px-1 mb-1">Signed in as</p>
                <p className="text-sm text-white px-1 mb-3 truncate">{user.email}</p>
                <button
                  onClick={() => {
                    logout();
                    setShowUserMenu(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 text-xs py-2 rounded-lg bg-red-500/10 border border-red-400/20 text-red-300 hover:bg-red-500/20 transition"
                >
                  <FiLogOut className="text-sm" />
                  Sign Out
                </button>
              </div>
            )}
          </div>
        ) : (
          // Compact login button — does NOT block app usage
          <div className="hidden sm:block">
            <LoginButton />
          </div>
        )}

        {/* ── SETTINGS BUTTON (Gemini API key — Phase 1) ──────── */}
        <div className="relative">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            title="API Key Settings"
          >
            <FiSettings className="text-lg" />
          </button>

          {showSettings && (
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
                className="w-full text-xs py-2 rounded-lg bg-cyan-500/10 border border-cyan-400/20 text-cyan-300 hover:bg-cyan-500/20 transition mb-2"
              >
                Update API Key
              </button>
              <button
                onClick={handleClearKey}
                className="w-full text-xs py-2 rounded-lg bg-red-500/10 border border-red-400/20 text-red-300 hover:bg-red-500/20 transition"
              >
                Remove Key
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-16 md:py-24">
        <HeroSection />

        {/* Mobile-only login prompt — shown inline since the
            top-right button is hidden on small screens to save
            space. Dismissible, never blocks the app. */}
        {!user && (
          <div className="sm:hidden flex justify-center mb-6">
            <LoginButton />
          </div>
        )}

        {geminiKey ? <UploadBox geminiKey={geminiKey} /> : null}
      </div>

      {/* ── GEMINI API KEY MODAL (Phase 1 — blocking, required) ── */}
      {geminiKey === "" && <ApiKeyModal onKeySaved={handleKeySaved} />}
    </div>
  );
}

export default App;