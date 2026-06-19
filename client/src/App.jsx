// ============================================================
// App.jsx
//
// WHAT CHANGED FROM YOUR ORIGINAL:
// Added API key state management at the top level.
//
// WHY HERE AND NOT IN UploadBox?
// The API key is app-wide — every AI request needs it.
// Keeping it in App.jsx means we check for it once on
// load and pass it down. This is called "lifting state up"
// in React — putting shared state at the highest component
// that needs it.
//
// HOW THE KEY FLOWS:
// App.jsx reads localStorage on mount
//   → if found: store in state, show main app
//   → if not found: show ApiKeyModal
//   → when user saves key: store in state, hide modal
//   → pass key as prop to UploadBox
//   → UploadBox passes it to generateAI() call
//   → aiApi.js sends it in request header to backend
//   → aiController.js reads it from header, uses it for Gemini
// ============================================================

import { useState, useEffect } from "react";
import "./App.css";
import BackgroundGlow from "./components/BackgroundGlow";
import HeroSection from "./components/HeroSection";
import UploadBox from "./components/UploadBox";
import ApiKeyModal from "./components/ApiKeyModal";
import { FiSettings } from "react-icons/fi";

function App() {
  // null = not checked yet | "" = no key | "AIza..." = has key
  const [geminiKey, setGeminiKey] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  // ──────────────────────────────────────────────────────
  // ON MOUNT: Check if user already has a key saved
  // useEffect with [] runs once when the component loads.
  // This is like "componentDidMount" in class components.
  // ──────────────────────────────────────────────────────
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

  // Still checking localStorage — show nothing yet
  // (avoids flash of modal before we know if key exists)
  if (geminiKey === null) return null;

  return (
    <div className="relative min-h-screen bg-[#030712] overflow-hidden text-white">
      <BackgroundGlow />

      {/* ── SETTINGS BUTTON ───────────────────────────────
          Shown in top-right corner so user can update
          or clear their API key at any time.
      ──────────────────────────────────────────────────── */}
      <div className="absolute top-4 right-4 z-20">
        <div className="relative">
          <button
            onClick={() => setShowSettings((v) => !v)}
            className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
            title="API Key Settings"
          >
            <FiSettings className="text-lg" />
          </button>

          {/* SETTINGS DROPDOWN */}
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
                  setGeminiKey(""); // This triggers the modal
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

      {/* ── MAIN CONTENT ─────────────────────────────────── */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-16 md:py-24">
        <HeroSection />

        {/* Only show UploadBox if we have a key */}
        {geminiKey ? (
          <UploadBox geminiKey={geminiKey} />
        ) : null}
      </div>

      {/* ── API KEY MODAL ────────────────────────────────────
          Shows when geminiKey is empty string "".
          AnimatePresence in ApiKeyModal handles the animation.
      ──────────────────────────────────────────────────────── */}
      {geminiKey === "" && (
        <ApiKeyModal onKeySaved={handleKeySaved} />
      )}
    </div>
  );
}

export default App;