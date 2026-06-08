import { useState } from "react";
import ResponseViewer from "./ResponseViewer";
import { motion, AnimatePresence } from "framer-motion";
import { FiUploadCloud } from "react-icons/fi";
import { uploadFiles } from "../api/uploadApi";
import { generateAI } from "../api/aiApi";

// File type icon helper
const getFileIcon = (name = "") => {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return "📄";
  if (["ppt", "pptx"].includes(ext)) return "📊";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (ext === "txt") return "📃";
  return "📁";
};

// AI mode config
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

function UploadBox() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");
  const [isProcessed, setIsProcessed] = useState(false);
  const [processedFileNames, setProcessedFileNames] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [activeMode, setActiveMode] = useState(null);
  const [aiResult, setAiResult] = useState("");
  const [copied, setCopied] = useState(false);

  // ── CACHING ──────────────────────────────────────────
  // Stores results per mode: { summary: "...", notes: "...", explain: "..." }
  // When user clicks the same button twice, we show the
  // cached result instantly — zero Gemini tokens used.
  // Cache is cleared whenever new files are uploaded.
  const [cachedResults, setCachedResults] = useState({});

  // ==========================================
  // FILE SELECTION
  // ==========================================

  const handleFilesChange = (e) => {
    const selected = Array.from(e.target.files);
    setFiles((prev) => {
      const existing = new Set(prev.map((f) => f.name));
      const newFiles = selected.filter((f) => !existing.has(f.name));
      return [...prev, ...newFiles];
    });
    setSuccess("");
    setError("");
    setAiResult("");
    setIsProcessed(false);
    setActiveMode(null);
    setCachedResults({}); // Clear cache when files change
  };

  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    setIsProcessed(false);
    setAiResult("");
    setActiveMode(null);
    setCachedResults({}); // Clear cache when files change
  };

  // ==========================================
  // UPLOAD + PROCESS
  // ==========================================

  const handleUpload = async () => {
    if (files.length === 0) return;

    setLoading(true);
    setError("");
    setSuccess("");
    setAiResult("");
    setIsProcessed(false);
    setActiveMode(null);
    setCachedResults({}); // Clear cache on new upload

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const data = await uploadFiles(formData);

      setSuccess(
        `${data.files.length} file${data.files.length > 1 ? "s" : ""} processed successfully`
      );
      setProcessedFileNames(data.files.map((f) => f.fileName));
      setIsProcessed(true);
    } catch (err) {
      setError(err.response?.data?.message || "Upload failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // AI GENERATION — WITH CACHING
  // ==========================================

  const generateContent = async (type) => {
    // ── CACHE HIT: show stored result, no API call ──
    if (cachedResults[type]) {
      setAiResult(cachedResults[type]);
      setActiveMode(type);
      return; // Zero tokens used
    }

    // ── CACHE MISS: call Gemini ──
    try {
      setError("");
      setAiLoading(true);
      setActiveMode(type);
      setAiResult("");

      const data = await generateAI(null, type);

      // Save to cache so next click is instant
      setCachedResults((prev) => ({ ...prev, [type]: data.result }));
      setAiResult(data.result);
    } catch (err) {
      setError(err.response?.data?.message || "AI generation failed. Please try again.");
      setAiResult("");
      setActiveMode(null);
    } finally {
      setAiLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(aiResult);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ==========================================
  // RENDER
  // ==========================================

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mt-10 border border-white/10 bg-white/[0.04] backdrop-blur-2xl rounded-[28px] p-4 sm:p-8 md:p-12 shadow-[0_0_60px_rgba(0,255,255,0.04)]"
    >
      {/* ── HEADER ── */}
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
          Upload PDFs, DOCX, PPTX or TXT — get instant summaries, study notes,
          and explanations.
        </p>

        <label
          htmlFor="fileUpload"
          className="mt-8 cursor-pointer inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 font-medium shadow-[0_0_25px_rgba(34,211,238,0.3)] text-white select-none"
        >
          <FiUploadCloud className="text-lg" />
          Select Documents
        </label>

        <input
          id="fileUpload"
          type="file"
          multiple
          accept=".pdf,.doc,.docx,.ppt,.pptx,.txt"
          onChange={handleFilesChange}
          className="hidden"
        />
      </div>

      {/* ── FILE CARDS ── */}
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
                key={`${file.name}-${index}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 overflow-hidden">
                  <span className="text-2xl shrink-0">{getFileIcon(file.name)}</span>
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

      {/* ── PROCESS BUTTON ── */}
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

      {/* ── STATUS ── */}
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

      {/* ── AI BUTTONS ── */}
      <AnimatePresence>
        {isProcessed && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-10"
          >
            {processedFileNames.length > 0 && (
              <p className="text-center text-xs text-gray-500 mb-5">
                Ready to analyze:{" "}
                <span className="text-gray-300">
                  {processedFileNames.join(", ")}
                </span>
              </p>
            )}

            <div className="flex flex-wrap justify-center gap-3">
              {AI_MODES.map((mode) => {
                const isActive = activeMode === mode.type;
                const isCached = !!cachedResults[mode.type];

                return (
                  <motion.button
                    key={mode.type}
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => generateContent(mode.type)}
                    disabled={aiLoading}
                    title={isCached ? "Cached — instant, no tokens used" : ""}
                    className={`
                      relative px-5 py-3 rounded-xl text-sm font-medium transition-all duration-300
                      border flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed
                      ${
                        isActive
                          ? "bg-cyan-500/20 border-cyan-400/40 text-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.2)]"
                          : "bg-white/[0.05] border-white/10 text-white hover:bg-white/[0.09] hover:border-white/20"
                      }
                    `}
                  >
                    <span className="text-base">{mode.icon}</span>
                    <span>{mode.label}</span>
                    {/* Green dot = cached, instant result */}
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

            {/* ── LOADING ── */}
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
                    transition={{ repeat: Infinity, duration: 1.8, ease: "linear" }}
                    className="w-12 h-12 rounded-full border-4 border-cyan-500/20 border-t-cyan-400"
                  />
                  <div className="text-center">
                    <p className="text-cyan-300 font-semibold">
                      Analyzing your documents...
                    </p>
                    <p className="text-gray-500 text-sm mt-1">
                      {activeMode === "summary" && "Building a precise overview"}
                      {activeMode === "notes" && "Creating revision-ready notes"}
                      {activeMode === "explain" && "Preparing a clear explanation"}
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── RESPONSE ── */}
            <AnimatePresence>
              {aiResult && !aiLoading && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="mt-8"
                >
                  <div className="border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-2xl rounded-2xl overflow-hidden">
                    {/* Response Header */}
                    <div className="px-5 py-3.5 border-b border-white/[0.06] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-lg">
                          {AI_MODES.find((m) => m.type === activeMode)?.icon}
                        </span>
                        <div>
                          <h3 className="text-sm font-semibold text-white">
                            {AI_MODES.find((m) => m.type === activeMode)?.label}{" "}
                            —{" "}
                            <span className="text-gray-400 font-normal">
                              {processedFileNames.length > 1
                                ? `${processedFileNames.length} documents`
                                : processedFileNames[0]}
                            </span>
                          </h3>
                          <p className="text-xs text-gray-500 mt-0.5">
                            {AI_MODES.find((m) => m.type === activeMode)?.description}
                            {cachedResults[activeMode] && (
                              <span className="ml-2 text-green-400">
                                · cached
                              </span>
                            )}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.05] border border-white/[0.08] hover:bg-white/[0.09] transition-all text-xs text-gray-400 hover:text-white"
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

                    {/* Response Content */}
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