// ============================================================
// FullScreenView.jsx
//
// The fixed inset-0 overlay shown once documents are processed
// and the user is in Chat/Summary/Notes/Explain mode — the
// Claude/Gemini-style full-screen layout. Combines the desktop
// sidebar, the mobile hamburger top bar, and the body (ChatPanel
// or the selected mode's ResponseViewer).
// ============================================================

import { motion, AnimatePresence } from "framer-motion";
import { FiMenu, FiX, FiCheck, FiCopy } from "react-icons/fi";
import { NAV_ITEMS, CHAT_SUGGESTIONS } from "../../constants/documentModes";
import ChatPanel from "../ChatPanel";
import ResponseViewer from "../ResponseViewer";
import DesktopSidebar from "./DesktopSidebar";
import MobileNavMenu from "./MobileNavMenu";

function FullScreenView({
  isVisible,
  sidebarOpen,
  setSidebarOpen,
  deskSessions,
  deskSessionsLoading,
  currentSessionId,
  activeMode,
  setActiveMode,
  selectedIds,
  setSelectedIds,
  cachedResults,
  setCachedResults,
  handleNavSelect,
  loadSessionById,
  handleDeleteDeskSession,
  user,
  menuOpen,
  setMenuOpen,
  handleCloseFullScreen,
  processedDocs,
  isPreloadedSession,
  geminiKey,
  token,
  preloadedChatHistory,
  aiLoading,
  analysisStage,
  error,
  aiResult,
  handleCopy,
  copied,
}) {
  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 12 }}
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-50 bg-[#030712] flex"
        >
          <DesktopSidebar
            sidebarOpen={sidebarOpen}
            setSidebarOpen={setSidebarOpen}
            activeMode={activeMode}
            selectedIds={selectedIds}
            cachedResults={cachedResults}
            handleNavSelect={handleNavSelect}
            user={user}
            deskSessionsLoading={deskSessionsLoading}
            deskSessions={deskSessions}
            currentSessionId={currentSessionId}
            loadSessionById={loadSessionById}
            handleDeleteDeskSession={handleDeleteDeskSession}
          />

          {/* RIGHT COLUMN — top bar + body */}
          <div className="flex-1 min-w-0 flex flex-col">
            {/* TOP BAR — hamburger (mobile only) switches Chat/Summary/
                Notes/Explain; close (right) returns to the upload screen. */}
            <div className="relative flex items-center justify-between px-4 sm:px-6 py-3 border-b border-white/10 shrink-0">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="sm:hidden w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                title="Switch section"
              >
                {menuOpen ? <FiX className="text-lg" /> : <FiMenu className="text-lg" />}
              </button>

              <h2 className="text-sm font-medium text-gray-300 truncate px-3">
                {NAV_ITEMS.find((n) => n.type === activeMode)?.label || "Chat"}
              </h2>

              <button
                onClick={() =>
                  activeMode === null
                    ? handleCloseFullScreen()
                    : setActiveMode(null)
                }
                className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all"
                title={
                  activeMode === null
                    ? "Close and return to upload screen"
                    : "Back to chat"
                }
              >
                <FiX className="text-lg" />
              </button>

              <MobileNavMenu
                menuOpen={menuOpen}
                setMenuOpen={setMenuOpen}
                activeMode={activeMode}
                handleNavSelect={handleNavSelect}
                selectedIds={selectedIds}
                cachedResults={cachedResults}
                processedDocs={processedDocs}
                setCachedResults={setCachedResults}
                setSelectedIds={setSelectedIds}
              />
            </div>

            {/* BODY — Chat, or the selected mode's response */}
            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
              {activeMode === null ? (
                <ChatPanel
                  key={`${currentSessionId || "session"}-${selectedIds.join(",")}`}
                  selectedIds={selectedIds}
                  isPreloadedSession={isPreloadedSession}
                  currentSessionId={currentSessionId}
                  geminiKey={geminiKey}
                  token={token}
                  initialMessages={preloadedChatHistory}
                  suggestions={CHAT_SUGGESTIONS}
                  modeOptions={NAV_ITEMS.filter((n) => n.type !== null)}
                  onSelectMode={handleNavSelect}
                  fullScreen
                />
              ) : (
                <div className="relative flex-1 min-h-0">
                  <div className="pointer-events-none absolute top-0 inset-x-0 h-6 sm:h-8 z-10 backdrop-blur-sm [mask-image:linear-gradient(to_bottom,black,transparent)]" />
                  <div className="h-full overflow-y-auto px-4 sm:px-6 py-5">
                  <div className="max-w-3xl mx-auto">
                    {aiLoading && (
                      <div className="flex flex-col items-center gap-4 py-16">
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{
                            repeat: Infinity,
                            duration: 1.2,
                            ease: "linear",
                          }}
                          className="w-10 h-10 rounded-full border-4 border-cyan-500/20 border-t-cyan-400"
                        />
                        <p className="text-cyan-300 font-medium text-center">
                          {analysisStage || "Analyzing documents..."}
                        </p>
                      </div>
                    )}

                    {!aiLoading && error && (
                      <p className="text-center text-red-400 text-sm py-6">{error}</p>
                    )}

                    {!aiLoading && aiResult && (
                    <motion.div
                      key={activeMode}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.25 }}
                    >
                      <div className="flex items-center justify-end mb-3">
                          <button
                            onClick={handleCopy}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs text-gray-400 hover:text-white"
                          >
                            {copied ? (
                              <FiCheck className="text-sm" />
                            ) : (
                              <FiCopy className="text-sm" />
                            )}
                            <span>{copied ? "Copied" : "Copy"}</span>
                          </button>
                        </div>
                        <ResponseViewer content={aiResult} />
                    </motion.div>
                  )}
                  </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default FullScreenView;