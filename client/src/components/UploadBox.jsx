// ============================================================
// UploadBox.jsx
//
// Orchestrator only. All logic lives in custom hooks
// (useFileUpload, useSessionLoader, useAIGeneration,
// useDesktopSessions); all JSX lives in components/upload/*.
// This file wires them together and holds only the state that
// genuinely needs to be shared across more than one hook.
// ============================================================

// HOW DRAG-AND-DROP WORKS IN THE BROWSER:
// Three events matter: dragover (fires continuously while
// something is dragged over the element — we must call
// preventDefault() or the browser blocks dropping entirely),
// dragleave (dragged item left the zone — reset visual state),
// and drop (the actual file drop — extract files from
// e.dataTransfer.files, which has the SAME shape as
// e.target.files from a normal file input, so it plugs into
// the existing handleFilesChange-style logic directly).
//
// We track `isDragging` purely for visual feedback (highlight
// the drop zone border) — it doesn't affect upload logic at all.
// ============================================================

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiUploadCloud } from "react-icons/fi";
import { useAuth } from "../context/AuthContext";
import { AI_MODES } from "../constants/documentModes";
import { useFileUpload } from "../hooks/useFileUpload";
import { useSessionLoader } from "../hooks/useSessionLoader";
import { useAIGeneration } from "../hooks/useAIGeneration";
import { useDesktopSessions } from "../hooks/useDesktopSessions";
import FileDropzone from "./upload/FileDropzone";
import ModeSelector from "./upload/ModeSelector";
import FullScreenView from "./upload/FullScreenView";

function UploadBox({ geminiKey, preloadedSession, onSessionSaved, onHeroVisibilityChange, onFullScreenChatChange }) {
  const { user, token } = useAuth();

  // ── STATE SHARED ACROSS MULTIPLE HOOKS ────────────────────
  const [error, setError] = useState("");
  const [isProcessed, setIsProcessed] = useState(false);
  const [processedFileNames, setProcessedFileNames] = useState([]);
  const [processedDocs, setProcessedDocs] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [activeMode, setActiveMode] = useState(null);
  const [aiResult, setAiResult] = useState("");
  const [glossary, setGlossary] = useState([]);
  const [cachedResults, setCachedResults] = useState({});
  const [showChat, setShowChat] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [currentSessionTitle, setCurrentSessionTitle] = useState(null);
  const [isTitleLoading, setIsTitleLoading] = useState(false);
  const [currentBatchId, setCurrentBatchId] = useState(null);
  const [preloadedChatHistory, setPreloadedChatHistory] = useState([]);
  const [copied, setCopied] = useState(false);

  // ── FILE UPLOAD (files, drag-drop, process/upload) ────────
  const {
    files,
    needsProcessing,
    loading,
    isDragging,
    handleFilesChange,
    removeFile,
    handleUpload,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    setFiles,
    setNeedsProcessing,
  } = useFileUpload({
    geminiKey,
    user,
    token,
    onSessionSaved,
    setProcessedFileNames,
    setProcessedDocs,
    setSelectedIds,
    setIsProcessed,
    setCurrentBatchId,
    setCurrentSessionId,
    setCurrentSessionTitle,
    setIsTitleLoading,
    setError,
    setAiResult,
    setGlossary,
    setActiveMode,
    setCachedResults,
    setPreloadedChatHistory,
    setShowChat,
  });

  // ── PAST SESSION LOADING (history sidebar / desktop sidebar) ──
  const { isLoadingPreload, loadSessionById } = useSessionLoader({
    token,
    preloadedSession,
    setCurrentSessionId,
    setCurrentSessionTitle,
    setProcessedDocs,
    setProcessedFileNames,
    setSelectedIds,
    setIsProcessed,
    setNeedsProcessing,
    setFiles,
    setCachedResults,
    setAiResult,
    setActiveMode,
    setPreloadedChatHistory,
    setShowChat,
    setMenuOpen,
    setError,
    setGlossary,
  });

  // Shared between generateContent() and ChatPanel — true when the
  // currently selected documents came from a loaded history session
  // rather than a fresh upload (see fake "preloaded-" IDs above).
  const isPreloadedSession = selectedIds.some((id) => id.startsWith("preloaded-"));

  // Maps the currently checked document ids to their real fileName —
  // same key generateFromSession/chatController match against for a
  // reopened session, so Summary/Notes/Explain honor checkboxes too.
  const selectedFileNames = processedDocs
    .filter((doc) => selectedIds.includes(doc.id))
    .map((doc) => doc.fileName);

  // ── AI GENERATION (Summary/Notes/Explain) ─────────────────
  const { aiLoading, analysisStage, generateContent, handleNavSelect } = useAIGeneration({
    geminiKey,
    user,
    token,
    selectedIds,
    selectedFileNames,
    cachedResults,
    setCachedResults,
    setAiResult,
    setGlossary,
    setActiveMode,
    setError,
    currentSessionId,
    isPreloadedSession,
    setMenuOpen,
  });

  // True while the full-screen chat is open — hides history + settings
  // (via onFullScreenChatChange, up to App.jsx) and triggers the desktop
  // sidebar's session list to (re)load.
  const isFullScreenOpen = isProcessed && !needsProcessing && showChat;

  useEffect(() => {
    if (onFullScreenChatChange) {
      onFullScreenChatChange(isFullScreenOpen);
    }
  }, [isFullScreenOpen, onFullScreenChatChange]);

  // ── DESKTOP SIDEBAR: session history, Claude/Gemini-style ───
  const { deskSessions, deskSessionsLoading, handleDeleteDeskSession } = useDesktopSessions({
    user,
    token,
    isFullScreenOpen,
  });

  // Hidden as soon as the user has files in play (uploading, processing,
  // or viewing a response) — no point burning screen space on the pitch
  // copy once they're actually using the tool, especially on mobile.
  useEffect(() => {
    if (onHeroVisibilityChange) {
      onHeroVisibilityChange(files.length > 0 || processedDocs.length > 0);
    }
  }, [files.length, processedDocs.length, onHeroVisibilityChange]);

  const handleCopy = () => {
    navigator.clipboard.writeText(aiResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Closing full-screen chat takes the user all the way back to a
  // clean upload screen — "close" means go home, not "go back one step".
  const handleCloseFullScreen = () => {
    setFiles([]);
    setNeedsProcessing(false);
    setIsProcessed(false);
    setProcessedFileNames([]);
    setProcessedDocs([]);
    setSelectedIds([]);
    setAiResult("");
    setGlossary([]);
    setActiveMode(null);
    setCachedResults({});
    setShowChat(false);
    setCurrentSessionId(null);
    setCurrentSessionTitle(null);
    setIsTitleLoading(false);
    setCurrentBatchId(null);
    setPreloadedChatHistory([]);
    setError("");
  };

  const hasAnyFiles = files.length > 0 || processedDocs.length > 0;

  // True from the moment file(s) are added until they've been
  // successfully processed — this is the "review your files
  // before processing" stage, which we want centered full-screen
  // rather than sitting at the top of the page.
  const isReviewingFiles = hasAnyFiles && !isProcessed;

  // Computed once per render instead of calling AI_MODES.find()
  // twice further down in JSX for the icon and label separately.
  const activeModeInfo = AI_MODES.find((m) => m.type === activeMode);

  // ── RENDER ──────────────────────────────────────────────
  return (
    <div
      className={
        isReviewingFiles
          ? "min-h-[70vh] sm:min-h-[75vh] flex items-center justify-center"
          : ""
      }
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        className={`${isReviewingFiles ? "w-full" : "mt-10"} border backdrop-blur-2xl rounded-[28px] p-4 sm:p-8 md:p-12 shadow-[0_0_60px_rgba(0,255,255,0.04)] transition-all duration-200 ${
          isDragging
            ? "border-cyan-400/60 bg-cyan-500/[0.08] scale-[1.01]"
            : "border-white/10 bg-white/[0.04]"
        }`}
      >
        {/* DRAG OVERLAY — shown on top while dragging, regardless
            of whether files already exist or it's the empty state */}
        <AnimatePresence>
          {isDragging && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 pointer-events-none flex items-center justify-center bg-black/40 backdrop-blur-sm"
            >
              <div className="flex flex-col items-center gap-3 px-8 py-6 rounded-3xl border-2 border-dashed border-cyan-400/60 bg-[#0a0e16]/90">
                <FiUploadCloud className="text-5xl text-cyan-400" />
                <p className="text-white font-medium">Drop files to upload</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {isLoadingPreload && (
          <div className="flex flex-col items-center justify-center py-16 gap-4">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
              className="w-10 h-10 rounded-full border-4 border-cyan-500/20 border-t-cyan-400"
            />
            <p className="text-gray-400 text-sm">Loading session...</p>
          </div>
        )}

        {!isLoadingPreload && (
          <FileDropzone
            hasAnyFiles={hasAnyFiles}
            files={files}
            processedFileNames={processedFileNames}
            needsProcessing={needsProcessing}
            loading={loading}
            error={error}
            removeFile={removeFile}
            handleFilesChange={handleFilesChange}
            handleUpload={handleUpload}
          >
            <ModeSelector
              isVisible={isProcessed && !needsProcessing && !showChat}
              processedDocs={processedDocs}
              processedFileNames={processedFileNames}
              selectedIds={selectedIds}
              setSelectedIds={setSelectedIds}
              cachedResults={cachedResults}
              setCachedResults={setCachedResults}
              activeMode={activeMode}
              aiLoading={aiLoading}
              analysisStage={analysisStage}
              generateContent={generateContent}
              setShowChat={setShowChat}
              setActiveMode={setActiveMode}
              setAiResult={setAiResult}
              showChat={showChat}
              isPreloadedSession={isPreloadedSession}
              currentSessionId={currentSessionId}
              geminiKey={geminiKey}
              token={token}
              preloadedChatHistory={preloadedChatHistory}
              aiResult={aiResult}
              glossary={glossary}
              activeModeInfo={activeModeInfo}
              handleCopy={handleCopy}
              copied={copied}
            />
          </FileDropzone>
        )}
      </motion.div>

      <FullScreenView
        isVisible={isProcessed && !needsProcessing && showChat}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        deskSessions={deskSessions}
        deskSessionsLoading={deskSessionsLoading}
        currentSessionId={currentSessionId}
        currentSessionTitle={currentSessionTitle}
        isTitleLoading={isTitleLoading}
        processedFileNames={processedFileNames}
        activeMode={activeMode}
        setActiveMode={setActiveMode}
        selectedIds={selectedIds}
        setSelectedIds={setSelectedIds}
        cachedResults={cachedResults}
        setCachedResults={setCachedResults}
        handleNavSelect={handleNavSelect}
        loadSessionById={loadSessionById}
        handleDeleteDeskSession={handleDeleteDeskSession}
        user={user}
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        handleCloseFullScreen={handleCloseFullScreen}
        processedDocs={processedDocs}
        isPreloadedSession={isPreloadedSession}
        geminiKey={geminiKey}
        token={token}
        preloadedChatHistory={preloadedChatHistory}
        aiLoading={aiLoading}
        analysisStage={analysisStage}
        error={error}
        aiResult={aiResult}
        glossary={glossary}
        handleCopy={handleCopy}
        copied={copied}
      />
    </div>
  );
}

export default UploadBox;