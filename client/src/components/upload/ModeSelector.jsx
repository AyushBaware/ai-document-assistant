import { motion, AnimatePresence } from "framer-motion";
import { AI_MODES } from "../../constants/documentModes";
import { getFileIcon } from "../../utils/fileIcons";
import ChatPanel from "../ChatPanel";
import ResponseViewer from "../ResponseViewer";

function ModeSelector({
  isVisible,
  processedDocs,
  processedFileNames,
  selectedIds,
  setSelectedIds,
  cachedResults,
  setCachedResults,
  activeMode,
  aiLoading,
  analysisStage,
  generateContent,
  setShowChat,
  setActiveMode,
  setAiResult,
  showChat,
  isPreloadedSession,
  currentSessionId,
  geminiKey,
  token,
  preloadedChatHistory,
  aiResult,
  glossary,
  aiSourceFileNames = [],
  activeModeInfo,
  handleCopy,
  copied,
}) {
  const modeSourceLabel =
    aiSourceFileNames.length > 0
      ? aiSourceFileNames.length === 1
        ? aiSourceFileNames[0]
        : aiSourceFileNames.length === processedFileNames.length
        ? `All ${aiSourceFileNames.length} documents`
        : `${aiSourceFileNames.length} of ${processedFileNames.length} documents`
      : processedFileNames.length > 1
      ? `${processedFileNames.length} documents`
      : processedFileNames[0];

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6"
        >
          {processedDocs.length > 1 && (
            <div className="mb-5">
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-center text-xs text-gray-400 sm:text-left">
                    Select documents to include in analysis:
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center sm:justify-end">
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedIds(processedDocs.map((doc) => doc.id))
                      }
                      className="cursor-pointer text-xs px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/20 text-cyan-200 hover:bg-cyan-500/20 transition"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedIds([])}
                      className="cursor-pointer text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition"
                    >
                      Clear selection
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {processedDocs.map((doc) => {
                    const isSelected = selectedIds.includes(doc.id);
                    return (
                      <label
                        key={doc.id}
                        className={`flex min-w-0 items-center justify-between gap-3 p-3 rounded-lg border cursor-pointer select-none transition-all ${
                          isSelected
                            ? "border-cyan-400/40 bg-cyan-500/5"
                            : "border-white/5 bg-white/[0.02] hover:border-white/10"
                        }`}
                      >
                        <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                          <span className="text-lg shrink-0">
                            {getFileIcon(doc.fileName)}
                          </span>
                          <div className="overflow-hidden min-w-0 flex-1">
                            <div className="text-sm text-white font-medium truncate">
                              {doc.displayName || doc.fileName}
                            </div>
                            <div className="text-xs text-gray-500">
                              {doc.chunkCount} chunks parsed
                            </div>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {
                            // NOTE: cache is already scoped per-selection via
                            // its key, so we no longer wipe it here — doing
                            // so previously nuked every already-generated
                            // Summary/Notes/Explain the instant any checkbox
                            // was toggled.
                            setSelectedIds((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== doc.id)
                                : [...prev, doc.id],
                            );
                          }}
                          className="w-4 h-4 accent-cyan-400 cursor-pointer shrink-0"
                        />
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {AI_MODES.map((mode) => {
              const isActive = activeMode === mode.type;
              const modeCacheKey = `${mode.type}_${[...selectedIds].sort().join(",")}`;
              const isCached = !!cachedResults[modeCacheKey];

              return (
                <motion.button
                  key={mode.type}
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => {
                    setShowChat(false);
                    generateContent(mode.type);
                  }}
                  disabled={aiLoading || selectedIds.length === 0}
                  className={`relative w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 border flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isActive
                      ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                      : "bg-white/[0.05] border-white/10 text-white hover:bg-white/10"
                  }`}
                >
                  <span className="text-base">{mode.icon}</span>
                  <span>{mode.label}</span>
                  {isCached && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-green-400 absolute top-2 right-2"
                      title="Cached"
                    />
                  )}
                </motion.button>
              );
            })}

            <motion.button
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                setActiveMode(null);
                setAiResult("");
                setShowChat(true);
              }}
              disabled={selectedIds.length === 0}
              className={`relative w-full px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 border flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                showChat
                  ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                  : "bg-white/[0.05] border-white/10 text-white hover:bg-white/10"
              }`}
            >
              <span className="text-base">💬</span>
              <span>Ask Questions</span>
            </motion.button>
          </div>

          {/* First-ever generation — nothing to show yet, use the full spinner. */}
          <AnimatePresence>
            {aiLoading && !aiResult && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mt-10 flex flex-col items-center gap-4"
              >
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{
                    repeat: Infinity,
                    duration: 1.2,
                    ease: "linear",
                  }}
                  className="w-10 h-10 rounded-full border-4 border-cyan-500/20 border-t-cyan-400"
                />
                <div className="text-center">
                  <p className="text-cyan-300 font-medium">
                    {analysisStage || "Analyzing documents..."}
                  </p>
                  <p className="text-gray-500 text-sm mt-1">
                    {activeMode === "summary" &&
                      "Building a precise overview..."}
                    {activeMode === "notes" &&
                      "Creating revision-ready notes..."}
                    {activeMode === "explain" &&
                      "Preparing a clear explanation..."}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showChat && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-8"
              >
                <ChatPanel
                  key={selectedIds.join(",")}
                  selectedIds={selectedIds}
                  isPreloadedSession={isPreloadedSession}
                  currentSessionId={currentSessionId}
                  geminiKey={geminiKey}
                  token={token}
                  initialMessages={preloadedChatHistory}
                />
              </motion.div>
            )}
          </AnimatePresence>

          {/* Once anything has been generated, the panel stays up — a
              regeneration (new selection, cache miss) dims it and shows a
              status line instead of hiding the content. */}
          <AnimatePresence>
            {aiResult && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="mt-8"
              >
                <div className="border border-white/10 bg-white/[0.02] sm:bg-gradient-to-b sm:from-white/[0.05] sm:to-white/[0.01] backdrop-blur-2xl rounded-2xl overflow-hidden">
                  <div className="px-3 sm:px-5 py-3 sm:py-3.5 border-b border-white/10 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-lg shrink-0">
                        {activeModeInfo?.icon}
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-white truncate">
                          {activeModeInfo?.label}
                        </h3>
                        {modeSourceLabel && (
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">
                            Based on: <span className="text-cyan-300/80">{modeSourceLabel}</span>
                          </p>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={handleCopy}
                      className="cursor-pointer group relative flex items-center justify-center p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs text-gray-400 hover:text-white shrink-0"
                    >
                      <span>{copied ? "✓" : "⧉"}</span>
                      <span className="pointer-events-none absolute -bottom-9 left-1/2 -translate-x-1/2 z-20 hidden sm:flex flex-col items-center opacity-0 scale-95 transition-all duration-150 sm:group-hover:opacity-100 sm:group-hover:scale-100">
                        <span className="rounded-md border border-white/10 bg-[#0d1117] px-2.5 py-1 text-[11px] font-medium text-gray-200 shadow-lg shadow-black/40 whitespace-nowrap">
                          {copied ? "Copied" : "Copy"}
                        </span>
                        <span className="w-2 h-2 -mt-1 rotate-45 border-l border-t border-white/10 bg-[#0d1117]" />
                      </span>
                    </button>
                  </div>

                  <div className="relative max-h-[78vh] sm:max-h-[80vh]">
                    <div className="pointer-events-none absolute top-0 inset-x-0 h-6 sm:h-8 z-10 backdrop-blur-sm [mask-image:linear-gradient(to_bottom,black,transparent)] rounded-t-2xl" />
                    <div
                      className={`h-full overflow-y-auto px-3 sm:px-6 py-4 sm:py-5 transition-opacity duration-500 ${
                        aiLoading ? "opacity-0 pointer-events-none" : "opacity-100"
                      }`}
                    >
                      <ResponseViewer content={aiResult} glossary={glossary} />
                    </div>

                    {/* Centered "generating" overlay — the previous result
                        fades out smoothly and this fades in over it while a
                        new selection's Summary/Notes/Explain is produced. */}
                    <AnimatePresence>
                      {aiLoading && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          transition={{ duration: 0.35 }}
                          className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-[#030712]/70 backdrop-blur-sm rounded-2xl"
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                            className="w-10 h-10 rounded-full border-4 border-cyan-500/20 border-t-cyan-400"
                          />
                          <p className="text-cyan-300 font-medium text-sm text-center px-4">
                            {analysisStage || "Analyzing documents..."}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default ModeSelector;