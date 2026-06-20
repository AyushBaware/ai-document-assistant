// ============================================================
// UploadBox.jsx
//
// REDESIGNED FOR SIMPLICITY — matches how Claude's file upload
// actually works:
//
// - ONE persistent "Add files" control, always visible
// - Clicking it ANY TIME (before or after other files exist,
//   before or after processing) just adds files to the list
// - Each file has its own ✕ to remove it individually
// - There is NO separate "Start Over" / "New Upload" / "Process
//   New Files" button anymore — that was unnecessary complexity.
//   If you want to remove everything, remove each file with ✕,
//   or remove them all and the empty state naturally returns.
// - "Process Documents" runs whenever you have files staged
//   that haven't been processed yet. After processing, adding
//   another file simply marks the whole batch as "needs
//   reprocessing" again — one button, same label, every time.
//
// WHY THIS IS BETTER THAN THE PREVIOUS VERSION:
// The previous version had 3 different buttons doing
// overlapping things (Add Files / Process New Files / Start
// Over) which forced the user to understand an internal state
// machine. A good UI hides that complexity. Now there is ONE
// upload control and ONE process button — exactly like Claude,
// ChatGPT, and every well-designed AI tool handles attachments.
//
// HOW REPROCESSING WORKS NOW:
// We track `needsProcessing` — true whenever the current file
// list doesn't match what was last successfully processed.
// Adding/removing a file sets this true. Clicking "Process
// Documents" sends the CURRENT full file list (not a diff) —
// this matches how uploadController.js already works (it
// always replaces the knowledgeStore with whatever batch it
// receives), so there's no special "combine old + new" logic
// needed anymore. One source of truth: `files` state.
// ============================================================

import { useState, useEffect } from "react";
import ResponseViewer from "./ResponseViewer";
import { motion, AnimatePresence } from "framer-motion";
import { FiUploadCloud, FiPlus } from "react-icons/fi";
import { uploadFiles } from "../api/uploadApi";
import { generateAI } from "../api/aiApi";
import { useAuth } from "../context/AuthContext";
import { createSession, updateSessionResponse, getSessionById } from "../api/sessionApi";

const getFileIcon = (name = "") => {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return "📄";
  if (["ppt", "pptx"].includes(ext)) return "📊";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (ext === "txt") return "📃";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "🖼️";
  return "📁";
};

const AI_MODES = [
  { type: "summary", label: "Summary", icon: "⚡", description: "Key points at a glance" },
  { type: "notes",   label: "Notes",   icon: "📋", description: "Revision-ready study notes" },
  { type: "explain", label: "Explain", icon: "🧠", description: "Deep concept walkthrough" },
];

function UploadBox({ geminiKey, preloadedSession, onSessionSaved }) {
  const { user, token } = useAuth();

  // ── SINGLE SOURCE OF TRUTH FOR FILES ────────────────────
  // `files` always represents the COMPLETE current set the
  // user wants analyzed — whether that's their first selection
  // or after adding/removing items. No separate "staged" vs
  // "processed" file lists to keep in sync.
  const [files, setFiles] = useState([]);
  const [needsProcessing, setNeedsProcessing] = useState(false);

  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState("");
  const [isProcessed, setIsProcessed]       = useState(false);
  const [processedFileNames, setProcessedFileNames] = useState([]);
  const [processedDocs, setProcessedDocs]   = useState([]);
  const [selectedIds, setSelectedIds]       = useState([]);
  const [aiLoading, setAiLoading]           = useState(false);
  const [activeMode, setActiveMode]         = useState(null);
  const [aiResult, setAiResult]             = useState("");
  const [analysisStage, setAnalysisStage]   = useState("");
  const [copied, setCopied]                 = useState(false);
  const [cachedResults, setCachedResults]   = useState({});

  const [currentSessionId, setCurrentSessionId] = useState(null);
  const [isLoadingPreload, setIsLoadingPreload] = useState(false);

  // ── LOAD A PRELOADED SESSION (from history sidebar click) ──
  useEffect(() => {
    if (!preloadedSession) return;

    const loadPreloadedSession = async () => {
      try {
        setIsLoadingPreload(true);
        setError("");

        const data = await getSessionById(preloadedSession, token);
        const session = data.session;

        setCurrentSessionId(session.id);
        setProcessedDocs(
          session.documents.map((d, i) => ({
            id: `preloaded-${i}`,
            fileName: d.fileName,
            mimetype: d.mimetype,
            chunkCount: d.chunkCount,
          }))
        );
        setProcessedFileNames(session.documents.map((d) => d.fileName));
        setSelectedIds(session.documents.map((_, i) => `preloaded-${i}`));
        setIsProcessed(true);
        setNeedsProcessing(false);
        setFiles([]);

        const preloadedCache = {};
        ["summary", "notes", "explain"].forEach((type) => {
          if (session.responses?.[type]?.result) {
            const cacheKey = `${type}_${session.documents.map((_, i) => `preloaded-${i}`).sort().join(",")}`;
            preloadedCache[cacheKey] = session.responses[type].result;
          }
        });
        setCachedResults(preloadedCache);
        setAiResult("");
        setActiveMode(null);

      } catch (err) {
        setError("Failed to load this session.");
      } finally {
        setIsLoadingPreload(false);
      }
    };

    loadPreloadedSession();
  }, [preloadedSession]);

  // ── ADD FILES ────────────────────────────────────────────
  // Works identically whether this is the very first selection
  // or adding more after a batch is already processed. Always
  // merges into the existing list, never replaces it.
  const handleFilesChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const newOnes = selected.filter((f) => !existing.has(`${f.name}-${f.size}`));
      return [...prev, ...newOnes];
    });
    setError("");
    setNeedsProcessing(true);
    // Clear results — the file set changed, old responses no
    // longer represent "all currently selected files."
    setAiResult("");
    setActiveMode(null);
    setCachedResults({});
    e.target.value = ""; // allows selecting the same filename again later if removed
  };

  // ── REMOVE A SINGLE FILE ─────────────────────────────────
  const removeFile = (index) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setNeedsProcessing(next.length > 0);
      return next;
    });
    setAiResult("");
    setActiveMode(null);
    setCachedResults({});
  };

  // ── PROCESS (initial or re-process after changes) ────────
  const handleUpload = async () => {
    if (files.length === 0) return;

    setLoading(true);
    setError("");
    setAiResult("");
    setActiveMode(null);
    setCachedResults({});
    setCurrentSessionId(null);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const data = await uploadFiles(formData);

      setProcessedFileNames(data.files.map((f) => f.fileName));
      setProcessedDocs(data.files);
      setSelectedIds(data.files.map((f) => f.id));
      setIsProcessed(true);
      setNeedsProcessing(false);

      if (user && token) {
        try {
          const documentIds = data.files.map((f) => f.id);
          const sessionData = await createSession(documentIds, token);
          setCurrentSessionId(sessionData.session.id);
          if (onSessionSaved) onSessionSaved();
        } catch (saveErr) {
          console.warn("Session save failed (non-blocking):", saveErr.message);
        }
      }

    } catch (err) {
      setError(err.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ── AI GENERATION ───────────────────────────────────────
  const generateContent = async (type) => {
    if (selectedIds.length === 0) {
      setError("Please select at least one document to analyze.");
      return;
    }

    const cacheKey = `${type}_${[...selectedIds].sort().join(",")}`;
    if (cachedResults[cacheKey]) {
      setAiResult(cachedResults[cacheKey]);
      setActiveMode(type);
      return;
    }

    try {
      setError("");
      setAiLoading(true);
      setAnalysisStage("Analyzing documents...");
      setActiveMode(type);
      setAiResult("");

      const data = await generateAI(null, type, selectedIds, geminiKey);

      setCachedResults((prev) => ({ ...prev, [cacheKey]: data.result }));
      setAiResult(data.result);

      if (user && token && currentSessionId) {
        try {
          await updateSessionResponse(currentSessionId, type, data.result, data.tokenBudget, token);
        } catch (saveErr) {
          console.warn("Response save failed (non-blocking):", saveErr.message);
        }
      }

    } catch (err) {
      setError(err.response?.data?.message || "AI generation failed. Please try again.");
      setAiResult("");
      setActiveMode(null);
    } finally {
      setAiLoading(false);
      setAnalysisStage("");
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(aiResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const hasAnyFiles = files.length > 0 || processedDocs.length > 0;

  // ── RENDER ──────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mt-10 border border-white/10 bg-white/[0.04] backdrop-blur-2xl rounded-[28px] p-4 sm:p-8 md:p-12 shadow-[0_0_60px_rgba(0,255,255,0.04)]"
    >
      {/* LOADING PRELOADED SESSION */}
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
        <>
          {/* EMPTY STATE — shown only when nothing has ever been added */}
          {!hasAnyFiles && (
            <div className="flex flex-col items-center text-center">
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                className="w-20 h-20 rounded-full bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.12)]"
              >
                <FiUploadCloud className="text-4xl text-cyan-400" />
              </motion.div>

              <h2 className="mt-6 text-2xl sm:text-4xl font-bold tracking-tight">
                AI Document Intelligence
              </h2>
              <p className="mt-3 text-gray-400 max-w-xl text-sm sm:text-base leading-7">
                Upload PDFs, DOCX, PPTX, TXT or Images — get instant summaries, study notes, and explanations.
              </p>

              <label
                htmlFor="fileUpload"
                className="mt-8 cursor-pointer inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 font-medium shadow-[0_0_25px_rgba(34,211,238,0.3)] text-white select-none"
              >
                <FiUploadCloud className="text-lg" />
                Select Documents / Images
              </label>

              <input
                id="fileUpload"
                type="file"
                multiple
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
                onChange={handleFilesChange}
                className="hidden"
              />
            </div>
          )}

          {/* ── ACTIVE STATE: files exist (staged and/or processed) ── */}
          {hasAnyFiles && (
            <div>
              {/* Compact header bar with a persistent "Add" control —
                  this is the ONLY upload entry point once files exist,
                  always visible, always just adds to the list. */}
              <div className="flex items-center justify-between gap-3 mb-5">
                <h2 className="text-lg sm:text-xl font-semibold text-white">
                  {processedFileNames.length > 0 && !needsProcessing
                    ? processedFileNames.length > 1
                      ? `${processedFileNames.length} documents ready`
                      : processedFileNames[0]
                    : "Your files"}
                </h2>

                <label
                  htmlFor="fileUploadPersistent"
                  className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/10 transition-all text-sm text-gray-200 select-none shrink-0"
                >
                  <FiPlus className="text-base" />
                  Add files
                </label>
                <input
                  id="fileUploadPersistent"
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
                  onChange={handleFilesChange}
                  className="hidden"
                />
              </div>

              {/* FILE CHIPS — every selected file, with its own ✕.
                  This is the single list users interact with. */}
              <AnimatePresence>
                {files.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6"
                  >
                    {files.map((file, index) => (
                      <motion.div
                        key={`${file.name}-${file.size}-${index}`}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04 }}
                        className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl flex items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 overflow-hidden">
                          <span className="text-2xl shrink-0">{getFileIcon(file.name)}</span>
                          <div className="overflow-hidden">
                            <p className="text-sm text-white truncate font-medium">{file.name}</p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {(file.size / 1024 / 1024).toFixed(2)} MB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(index)}
                          className="w-8 h-8 rounded-lg bg-red-500/10 border border-red-400/20 hover:bg-red-500/25 transition-all text-red-300 flex items-center justify-center shrink-0 text-sm"
                        >
                          ✕
                        </button>
                      </motion.div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* PROCESS BUTTON — appears whenever there are
                  unprocessed changes. Same button, same label,
                  whether this is the first process or a re-process
                  after adding/removing files. */}
              <AnimatePresence>
                {needsProcessing && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex justify-center mb-2"
                  >
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.97 }}
                      onClick={handleUpload}
                      disabled={loading}
                      className="px-8 py-3 rounded-2xl bg-cyan-500/15 border border-cyan-400/25 hover:bg-cyan-500/25 transition-all shadow-[0_0_25px_rgba(34,211,238,0.1)] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <span className="flex items-center gap-2">
                          <motion.span
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                            className="inline-block w-4 h-4 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full"
                          />
                          Processing...
                        </span>
                      ) : (
                        "Process Documents"
                      )}
                    </motion.button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* ERROR */}
              <AnimatePresence>
                {error && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="mt-3 text-center text-red-400 text-sm"
                  >
                    {error}
                  </motion.p>
                )}
              </AnimatePresence>

              {/* ── AI CONTROL PANEL — only when current batch is processed ── */}
              <AnimatePresence>
                {isProcessed && !needsProcessing && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-6"
                  >
                    {/* DOCUMENT SELECTION CHECKBOXES */}
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
                                onClick={() => setSelectedIds(processedDocs.map((doc) => doc.id))}
                                className="text-xs px-3 py-1 rounded-full bg-cyan-500/15 border border-cyan-400/20 text-cyan-200 hover:bg-cyan-500/20 transition"
                              >
                                Select all
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedIds([])}
                                className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition"
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
                                  <div className="flex items-center gap-3 overflow-hidden">
                                    <span className="text-lg shrink-0">{getFileIcon(doc.fileName)}</span>
                                    <div className="overflow-hidden">
                                      <div className="text-sm text-white font-medium truncate max-w-[160px] sm:max-w-[200px]">
                                        {doc.fileName}
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
                                      setCachedResults({});
                                      setSelectedIds((prev) =>
                                        isSelected
                                          ? prev.filter((id) => id !== doc.id)
                                          : [...prev, doc.id]
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

                    {/* AI MODE BUTTONS */}
                    <div className="flex flex-wrap justify-center gap-3">
                      {AI_MODES.map((mode) => {
                        const isActive = activeMode === mode.type;
                        const modeCacheKey = `${mode.type}_${[...selectedIds].sort().join(",")}`;
                        const isCached = !!cachedResults[modeCacheKey];

                        return (
                          <motion.button
                            key={mode.type}
                            whileHover={{ scale: 1.04 }}
                            whileTap={{ scale: 0.96 }}
                            onClick={() => generateContent(mode.type)}
                            disabled={aiLoading || selectedIds.length === 0}
                            className={`relative px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300 border flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                              isActive
                                ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                                : "bg-white/[0.05] border-white/10 text-white hover:bg-white/10"
                            }`}
                          >
                            <span className="text-base">{mode.icon}</span>
                            <span>{mode.label}</span>
                            {isCached && (
                              <span className="w-1.5 h-1.5 rounded-full bg-green-400 absolute top-2 right-2" title="Cached" />
                            )}
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* LOADING */}
                    <AnimatePresence>
                      {aiLoading && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="mt-10 flex flex-col items-center gap-4"
                        >
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                            className="w-10 h-10 rounded-full border-4 border-cyan-500/20 border-t-cyan-400"
                          />
                          <div className="text-center">
                            <p className="text-cyan-300 font-medium">
                              {analysisStage || "Analyzing documents..."}
                            </p>
                            <p className="text-gray-500 text-sm mt-1">
                              {activeMode === "summary" && "Building a precise overview..."}
                              {activeMode === "notes"   && "Creating revision-ready notes..."}
                              {activeMode === "explain" && "Preparing a clear explanation..."}
                            </p>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* RESPONSE */}
                    <AnimatePresence>
                      {aiResult && !aiLoading && (
                        <motion.div
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.4 }}
                          className="mt-8"
                        >
                          <div className="border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-2xl rounded-2xl overflow-hidden">
                            <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <span className="text-lg shrink-0">
                                  {AI_MODES.find((m) => m.type === activeMode)?.icon}
                                </span>
                                <div className="min-w-0">
                                  <h3 className="text-sm font-semibold text-white truncate">
                                    {AI_MODES.find((m) => m.type === activeMode)?.label}{" "}
                                    <span className="text-gray-400 font-normal">
                                      —{" "}
                                      {processedFileNames.length > 1
                                        ? `${processedFileNames.length} documents`
                                        : processedFileNames[0]}
                                    </span>
                                  </h3>
                                </div>
                              </div>
                              <button
                                onClick={handleCopy}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-all text-xs text-gray-400 hover:text-white shrink-0"
                              >
                                {copied ? (
                                  <><span>✓</span><span>Copied</span></>
                                ) : (
                                  <><span>⧉</span><span>Copy</span></>
                                )}
                              </button>
                            </div>

                            <div className="px-4 sm:px-6 py-5 max-h-[80vh] overflow-y-auto">
                              <ResponseViewer content={aiResult} />
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </>
      )}
    </motion.div>
  );
}

export default UploadBox;