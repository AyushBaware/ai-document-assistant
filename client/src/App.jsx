// Purpose: Coordinates startup checks, authentication, API-key setup, and the document workspace.

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import "./App.css";
import BackgroundGlow from "./components/BackgroundGlow";
import HeroSection from "./components/HeroSection";
import IntroScreen from "./components/IntroScreen";
import UploadBox from "./components/UploadBox";
import ApiKeyModal from "./components/ApiKeyModal";
import LoginButton from "./components/LoginButton";
import SessionHistory from "./components/SessionHistory";
import { useAuth } from "./context/AuthContext";
import { getApiKeyStatus, deleteApiKey } from "./api/apiKeyApi";
import {
  getGuestSession,
  convertGuestSession,
  clearGuestSession,
} from "./api/guestSessionApi";
import { useGuestUsage } from "./hooks/useGuestUsage";
import GuestUsageBadge from "./components/GuestUsageBadge";
import { usePWAUpdate } from "./hooks/usePWAUpdate";
import GuestLimitToast from "./components/GuestLimitToast";
import GuestLimitModal from "./components/GuestLimitModal";
import SaveGuestSessionModal from "./components/SaveGuestSessionModal";
import NotificationBell from "./components/NotificationBell";
import { FiSettings, FiLogOut, FiUser } from "react-icons/fi";

function App() {
  const [geminiKey, setGeminiKey] = useState(null);
  const [initialStatusChecked, setInitialStatusChecked] = useState(false);
  const [initialStatusSucceeded, setInitialStatusSucceeded] = useState(false);
  const [introDismissed, setIntroDismissed] = useState(false);
  const [showWakeMessage, setShowWakeMessage] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  // True only for the "Update API Key" flow — the backend key is
  // untouched in that case, so the modal can be cancelled (refresh
  // or click-outside) and the user lands back on the existing key.
  // False for "Remove Key" and first-time entry, where there is
  // genuinely no key saved — nothing to fall back to, so the modal
  // must stay locked until a real key is entered.
  const [keyModalDismissible, setKeyModalDismissible] = useState(false);

  const { user, token, isAuthLoading, logout } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const [selectedSessionId, setSelectedSessionId] = useState(null);
  const [sessionRefreshTrigger, setSessionRefreshTrigger] = useState(0);

  // Hidden as soon as the user has files in play (uploading, processing,
  // or viewing a response) — no point burning screen space on the pitch
  // copy once they're actually using the tool, especially on mobile.
  const [hideHero, setHideHero] = useState(false);

  // True while the full-screen chat is open — hides history + settings
  // so the chat screen has zero competing chrome.
  const [hideChrome, setHideChrome] = useState(false);

  // Only the INITIAL count comes from this fetch — everything after
  // that (badge updates, toast, hard-block modal) is fully automated
  // and event-driven via useGuestUsage below, with zero refresh needed.
  const [initialGuestRemaining, setInitialGuestRemaining] = useState(null);

  // Shown (via the existing GuestLimitToast component, reused as a
  // generic message banner) if THIS person's own Gemini key turns out
  // to already be registered on another account/device.
  const [keySharedWarning, setKeySharedWarning] = useState(null);

  // Shown when the currently active Gemini key hits a quota limit or
  // turns out to be invalid/expired mid-use — offers a direct path to
  // Settings to switch keys, instead of a one-off inline error only.
  const [keyIssueBanner, setKeyIssueBanner] = useState(null);

  // Extracted so it can run both on initial mount AND right after a
  // key is first saved — the guest request count doesn't exist yet
  // at mount time for a brand-new visitor (no ApiKey record until
  // they actually save a key), which was why the badge previously
  // only appeared after a manual page refresh.
  // Captures the deviceId from the VERY FIRST status check (page load)
  // and never overwrites it — this is the baseline every later check
  // gets compared against to detect blocked/non-persisting cookies.
  const firstDeviceIdRef = useRef(null);

  const refreshKeyStatus = async () => {
    try {
      const data = await getApiKeyStatus();
      setGeminiKey(data.hasKey ? "configured" : "");
      if (typeof data.guestRequestsRemaining === "number") {
        setInitialGuestRemaining(data.guestRequestsRemaining);
      }
      if (firstDeviceIdRef.current === null) {
        firstDeviceIdRef.current = data.deviceId;
      }
      return data;
    } catch {
      setGeminiKey("");
      return null;
    }
  };

  useEffect(() => {
    const checkInitialStatus = async () => {
      const data = await refreshKeyStatus();
      setInitialStatusSucceeded(!!data?.success);
      setShowWakeMessage(false);
      setInitialStatusChecked(true);
    };

    checkInitialStatus();
  }, []);

  useEffect(() => {
    if (initialStatusChecked) return;
    const timeout = window.setTimeout(() => setShowWakeMessage(true), 4000);
    return () => window.clearTimeout(timeout);
  }, [initialStatusChecked]);

  useEffect(() => {
    const handleKeyIssue = (e) => {
      setKeyIssueBanner(
        e.detail?.message || "Your API key can't be used right now.",
      );
    };
    window.addEventListener("gemini-key-issue", handleKeyIssue);
    return () => window.removeEventListener("gemini-key-issue", handleKeyIssue);
  }, []);

  const {
    remaining: guestRequestsRemaining,
    toastMessage: guestToastMessage,
    dismissToast: dismissGuestToast,
    showLimitModal: showGuestLimitModal,
    closeLimitModal: closeGuestLimitModal,
  } = useGuestUsage(initialGuestRemaining);

  const { needRefresh, updateServiceWorker } = usePWAUpdate();

  // The instant login succeeds, check whether this device had an
  // in-progress anonymous session staged — if so, ask the person
  // whether to keep it or start clean.
  const [guestSessionPreview, setGuestSessionPreview] = useState(null);
  const [isSavingGuestSession, setIsSavingGuestSession] = useState(false);
  const hasCheckedGuestSession = useRef(false);

  useEffect(() => {
    // Runs at most once per page load — prevents re-offering (and
    // potentially re-saving as a duplicate) the same stale guest
    // session if a prior save/discard silently failed and the
    // pending record was never actually cleared.
    if (!user || hasCheckedGuestSession.current) return;
    hasCheckedGuestSession.current = true;

    (async () => {
      try {
        const data = await getGuestSession();
        if (data?.session?.documents?.length > 0) {
          setGuestSessionPreview(data.session);
        }
      } catch {
        // Non-blocking.
      }
    })();
  }, [user]);

  const handleSaveGuestSession = async () => {
    try {
      setIsSavingGuestSession(true);
      const data = await convertGuestSession(token);
      setSelectedSessionId(data.session.id);
    } catch {
      // Non-blocking — worst case the person just re-uploads.
    } finally {
      setIsSavingGuestSession(false);
      setGuestSessionPreview(null);
    }
  };

  const handleDiscardGuestSession = async () => {
    setGuestSessionPreview(null);
    try {
      await clearGuestSession();
    } catch {
      // Non-blocking.
    }
  };

  const handleKeySaved = async () => {
    // Re-check status immediately — this is what actually populates
    // guestRequestsRemaining (5/5) the instant a fresh guest saves
    // their key, instead of waiting for a page refresh to catch up.
    const data = await refreshKeyStatus();

    // DEFINITIVE cookie-persistence check: if this request's deviceId
    // differs from the one captured on page load, the browser never
    // actually stored the cookie — every request is being treated as
    // a brand-new stranger. hasKey alone can't reliably catch this,
    // since the save and this re-check could coincidentally still
    // report true depending on timing.
    const cookiesBlocked =
      !!data &&
      !!firstDeviceIdRef.current &&
      data.deviceId !== firstDeviceIdRef.current;

    if (data?.hasKey && !cookiesBlocked) {
      setShowSettings(false);
    }

    return { ...data, cookiesBlocked };
  };

  const handleClearKey = async () => {
    // Genuinely removes the key from the backend now — previously
    // this only reset local state, so the key silently survived on
    // the server and refreshing the page brought the user right
    // back to the home screen with the "removed" key still active.
    setShowSettings(false);
    setKeyModalDismissible(false);
    setGeminiKey("");
    try {
      await deleteApiKey();
    } catch (err) {
      console.warn("Failed to remove API key on server:", err.message);
    }
  };

  // Backdrop click on the "Update API Key" modal only — the backend
  // key was never touched during an update, so this just re-syncs
  // local state with what's actually saved and closes the modal,
  // effectively cancelling the update.
  const handleDismissKeyModal = () => {
    setKeyModalDismissible(false);
    refreshKeyStatus();
  };

  const handleSelectSession = (sessionId) => {
    setSelectedSessionId(sessionId);
  };

  const handleSessionSaved = () => {
    setSessionRefreshTrigger((prev) => prev + 1);
  };

  if (!initialStatusChecked || isAuthLoading) {
    return (
      <div
        role="status"
        className="min-h-screen bg-[#030712] text-white flex flex-col items-center justify-center gap-4 px-4"
      >
        <span
          aria-hidden="true"
          className="h-8 w-8 rounded-full border-2 border-white/15 border-t-cyan-400 animate-spin"
        />
        <span className="sr-only">Loading DocuMind AI</span>
        {showWakeMessage && (
          <p className="text-center text-sm text-gray-400">
            Waking up the server, this can take up to a minute…
          </p>
        )}
      </div>
    );
  }

  if (
    initialStatusSucceeded &&
    !geminiKey &&
    !user &&
    !introDismissed
  ) {
    return <IntroScreen onGetStarted={() => setIntroDismissed(true)} />;
  }

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

        {/* SessionHistory renders only for signed-in users. */}
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
                    <p className="text-xs text-gray-400 px-1 mb-1">
                      Signed in as
                    </p>
                    <p className="text-sm text-white px-1 mb-3 truncate">
                      {user.email}
                    </p>
                    <button
                      onClick={() => {
                        logout();
                        setShowUserMenu(false);
                        setSelectedSessionId(null); // clear any loaded session on logout
                        refreshKeyStatus(); // re-fetch guest usage so the badge is accurate immediately, no manual refresh needed
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
            // Keep one GoogleLogin instance mounted to avoid reinitialization.
            !showGuestLimitModal && (
              <div className="scale-[0.85] sm:scale-100 origin-right">
                <LoginButton />
              </div>
            )
          )}

          <NotificationBell />

          <div className="relative">
            <button
              onClick={() => setShowSettings((v) => !v)}
              className="cursor-pointer w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
              data-tooltip="API Key Settings"
              data-tooltip-pos="bottom"
              data-tooltip-align="end"
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
                      ? "✓ Key configured and encrypted"
                      : "No key saved"}
                  </p>
                  <button
                    onClick={() => {
                      setShowSettings(false);
                      setKeyModalDismissible(true);
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
            Sign in to save your session history.
          </p>
        )}

        {geminiKey ? (
          <UploadBox
            geminiKey={geminiKey}
            preloadedSession={selectedSessionId}
            onSessionSaved={handleSessionSaved}
            onHeroVisibilityChange={setHideHero}
            onFullScreenChatChange={setHideChrome}
            guestRequestsRemaining={guestRequestsRemaining}
          />
        ) : null}
      </div>

      {geminiKey === "" && (
        <ApiKeyModal
          onKeySaved={handleKeySaved}
          onKeyShared={() =>
            setKeySharedWarning(
              "Notice: this API key is already registered on another account. You may see shared Google rate limits.",
            )
          }
          dismissible={keyModalDismissible}
          onDismiss={handleDismissKeyModal}
          guestRequestsRemaining={guestRequestsRemaining}
        />
      )}

      <GuestLimitToast
        message={keySharedWarning}
        onDismiss={() => setKeySharedWarning(null)}
      />

      <GuestLimitToast
        message={keyIssueBanner}
        onDismiss={() => setKeyIssueBanner(null)}
        actionLabel="Update Key"
        onAction={() => {
          setKeyIssueBanner(null);
          setShowSettings(true);
        }}
      />

      {!user && geminiKey !== "" && guestRequestsRemaining !== 0 && (
        <GuestUsageBadge remaining={guestRequestsRemaining} />
      )}
      {!user && (
        <GuestLimitToast
          message={guestToastMessage}
          onDismiss={dismissGuestToast}
        />
      )}
      {showGuestLimitModal && (
        <GuestLimitModal onClose={closeGuestLimitModal} />
      )}

      {guestSessionPreview && (
        <SaveGuestSessionModal
          documents={guestSessionPreview.documents}
          onSave={handleSaveGuestSession}
          onDiscard={handleDiscardGuestSession}
          isSaving={isSavingGuestSession}
        />
      )}

      <GuestLimitToast
        message={needRefresh ? "A new version is available." : null}
        onDismiss={() => {}}
        actionLabel="Update"
        onAction={() => updateServiceWorker(true)}
      />
    </motion.div>
  );
}

export default App;
