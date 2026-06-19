// ============================================================
// UploadBox.jsx
//
// WHAT CHANGED FROM YOUR ORIGINAL:
// 1. Accepts `geminiKey` as a prop from App.jsx
// 2. Passes `geminiKey` to generateAI() call
// Everything else is identical to your current version.
//
// WHY AS A PROP?
// Props flow downward in React (parent → child).
// App.jsx owns the key state, passes it down to UploadBox,
// which passes it to the API call. This is the clean pattern
// for sharing state across components.
// ============================================================

import { useState } from "react";
import ResponseViewer from "./ResponseViewer";
import { motion, AnimatePresence } from "framer-motion";
import { FiUploadCloud } from "react-icons/fi";
import { uploadFiles } from "../api/uploadApi";
import { generateAI } from "../api/aiApi";

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
  {
    type: "summary",
    label: "Summary",
    icon: "⚡",
    description: "Key points at a glance",
  },
  {
    type: "notes",
    label: "Notes",
    icon: "📋",
    description: "Revision-ready study notes",
  },
  {
    type: "explain",
    label: "Explain",
    icon: "🧠",
    description: "Deep concept walkthrough",
  },
];

// geminiKey comes from App.jsx via props
function UploadBox({ geminiKey }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isProcessed, setIsProcessed] = useState(false);
  const [processedFileNames, setProcessedFileNames] = useState([]);
  const [processedDocs, setProcessedDocs] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeMode, setActiveMode] = useState(null);
  const [aiResult, setAiResult] = useState("");
  const [analysisStage, setAnalysisStage] = useState("");
  const [copied, setCopied] = useState(false);
  const [cachedResults, setCachedResults] = useState({});

  // ── FILE SELECTION ──────────────────────────────────────
  const handleFilesChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      return [...prev, ...selected.filter((f) => !existing.has(f.name))];
    });
    setSuccess("");
    setError("");
    setAiResult("");
    setIsProcessed(false);
    setActiveMode(null);
    setCachedResults({});
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setIsProcessed(false);
    setAiResult("");
    setActiveMode(null);
    setCachedResults({});
  };

  // ── UPLOAD + PROCESS ────────────────────────────────────
  const handleUpload = async () => {
    if (files.length === 0) return;
    setLoading(true);
    setError("");
    setSuccess("");
    setAiResult("");
    setIsProcessed(false);
    setActiveMode(null);
    setCachedResults({});

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const data = await uploadFiles(formData);

      setSuccess(
        `${data.files.length} file${data.files.length > 1 ? "s" : ""} processed successfully`,
      );
      setProcessedFileNames(data.files.map((f) => f.fileName));
      setProcessedDocs(data.files);
      setSelectedIds(data.files.map((f) => f.id));
      setIsProcessed(true);
    } catch (err) {
      setError(
        err.response?.data?.message || "Upload failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  // ── AI GENERATION ───────────────────────────────────────
  // CACHING: We build a cache key from mode + selected doc IDs.
  // If the user clicks the same button with the same docs selected,
  // we return the cached result instantly — zero Gemini tokens used.
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

      // Pass geminiKey to the API call — it goes in the request header
      const data = await generateAI(null, type, selectedIds, geminiKey);

      setCachedResults((prev) => ({ ...prev, [cacheKey]: data.result }));
      setAiResult(data.result);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "AI generation failed. Please try again.",
      );
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

  // ── RENDER ──────────────────────────────────────────────
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mt-10 border border-white/10 bg-white/[0.04] backdrop-blur-2xl rounded-[28px] p-4 sm:p-8 md:p-12 shadow-[0_0_60px_rgba(0,255,255,0.04)]"
    >
      {/* HEADER */}
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
          Upload PDFs, DOCX, PPTX, TXT or Images — get instant summaries, study
          notes, and explanations.
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

      {/* FILE CARDS */}
      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="mt-8 grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {files.map((file, index) => (
              <motion.div
                key={`${file.name}-${file.size}-${index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="text-2xl shrink-0">
                    {getFileIcon(file.name)}
                  </span>
                  <div className="overflow-hidden">
                    <p className="text-sm text-white truncate font-medium">
                      {file.name}
                    </p>
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

      {/* PROCESS BUTTON */}
      <AnimatePresence>
        {files.length > 0 && !isProcessed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="mt-8 flex justify-center"
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
                    transition={{
                      repeat: Infinity,
                      duration: 1,
                      ease: "linear",
                    }}
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

      {/* STATUS */}
      <AnimatePresence>
        {success && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-5 text-center text-green-400 text-sm"
          >
            ✓ {success}
          </motion.p>
        )}
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-5 text-center text-red-400 text-sm"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      {/* AI CONTROL PANEL */}
      <AnimatePresence>
        {isProcessed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10"
          >
            {/* DOCUMENT SELECTION CHECKBOXES */}
            {processedDocs.length > 0 && (
              <div className="mb-5 px-2 sm:px-4">
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

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-2xl mx-auto w-full">
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
                            <span className="text-lg shrink-0">
                              {getFileIcon(doc.fileName)}
                            </span>
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
                      <span
                        className="w-1.5 h-1.5 rounded-full bg-green-400 absolute top-2 right-2"
                        title="Cached"
                      />
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
                    {/* RESPONSE HEADER */}
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
                          <>
                            <span>✓</span>
                            <span>Copied</span>
                          </>
                        ) : (
                          <>
                            <span>⧉</span>
                            <span>Copy</span>
                          </>
                        )}
                      </button>
                    </div>

                    {/* RESPONSE CONTENT */}
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
    </motion.div>
  );
}

export default UploadBox;
