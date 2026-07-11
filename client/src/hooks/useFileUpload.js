import { useState, useRef } from "react";
import { ACCEPTED_EXTENSIONS } from "../constants/documentModes";
import { uploadFiles } from "../api/uploadApi";
import { createSession } from "../api/sessionApi";

// ============================================================
// useFileUpload.js
//
// Owns everything about getting files INTO the app: picking
// files (click or drag-and-drop), reviewing them before
// processing, uploading them to the backend, and (for logged-in
// users) auto-saving the resulting batch as a session.
//
// A successful upload also resets/repopulates state that other
// parts of UploadBox care about (processedDocs, selectedIds,
// activeMode, etc.) — those setters are passed in from the
// parent rather than duplicated here, since they're shared
// across upload / session-loading / AI-generation concerns.
// ============================================================
export function useFileUpload({
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
  setActiveMode,
  setCachedResults,
  setPreloadedChatHistory,
  setShowChat,
}) {
  const [files, setFiles] = useState([]);
  const [needsProcessing, setNeedsProcessing] = useState(false);
  const [loading, setLoading] = useState(false);

  // ── DRAG AND DROP STATE ─────────────────────────────────
  const [isDragging, setIsDragging] = useState(false);
  // Tracks nested dragenter/dragleave pairs — without this,
  // dragging over a CHILD element inside the drop zone fires
  // a spurious dragleave on the parent, causing flicker.
  const dragCounter = useRef(0);

  // ── SHARED FILE-ADDING LOGIC ─────────────────────────────
  // Used by BOTH the file input (click to browse) and drag-drop.
  // This is the single place new files actually get merged in,
  // so both entry points behave identically.
  const addFiles = (newFileList) => {
    const incoming = Array.from(newFileList);

    // Filter out unsupported file types client-side for instant
    // feedback — the backend still validates again (never trust
    // client-side validation alone for security).
    const valid = incoming.filter((f) => {
      const ext = "." + f.name.split(".").pop().toLowerCase();
      return ACCEPTED_EXTENSIONS.includes(ext);
    });

    const rejected = incoming.length - valid.length;

    setFiles((prev) => {
      const existing = new Set(prev.map((f) => `${f.name}-${f.size}`));
      const newOnes = valid.filter((f) => !existing.has(`${f.name}-${f.size}`));
      return [...prev, ...newOnes];
    });

    if (rejected > 0) {
      setError(
        `${rejected} file${rejected > 1 ? "s" : ""} skipped — unsupported format. Accepted: PDF, DOC, DOCX, PPT, PPTX, TXT, PNG, JPG, WEBP.`,
      );
    } else {
      setError("");
    }

    setNeedsProcessing(true);
    setAiResult("");
    setActiveMode(null);
    setCachedResults({});
    setShowChat(false);
  };

  const handleFilesChange = (e) => {
    addFiles(e.target.files);
    e.target.value = ""; // allows re-selecting the same filename later if removed
  };

  // ── DRAG AND DROP HANDLERS ───────────────────────────────
  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current += 1;
    if (e.dataTransfer.types.includes("Files")) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current -= 1;
    if (dragCounter.current <= 0) {
      dragCounter.current = 0;
      setIsDragging(false);
    }
  };

  const handleDragOver = (e) => {
    // REQUIRED: without preventDefault here, the browser's
    // default behavior (usually opening the file in a new tab)
    // takes over and the drop event never fires.
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current = 0;
    setIsDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(e.dataTransfer.files);
    }
  };

  const removeFile = (index) => {
    setFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      setNeedsProcessing(next.length > 0);
      return next;
    });
    setAiResult("");
    setActiveMode(null);
    setCachedResults({});
    setShowChat(false);
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
    setCurrentSessionTitle(null);
    setCurrentBatchId(null);
    setPreloadedChatHistory([]);
    setShowChat(false);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const data = await uploadFiles(formData, geminiKey);

      setProcessedFileNames(data.files.map((f) => f.displayName || f.fileName));
      setProcessedDocs(data.files);
      setSelectedIds(data.files.map((f) => f.id));
      setIsProcessed(true);
      setNeedsProcessing(false);
      setCurrentBatchId(data.batchId);

      // Skip the mode-selection screen entirely — land straight in
      // full-screen chat, matching the Claude/Gemini-style flow.
      setShowChat(true);

      if (user && token) {
        // Title generation (Groq) happens server-side inside createSession
        // itself — isTitleLoading covers that round trip so the header
        // shows nothing rather than flashing the filename first.
        setIsTitleLoading(true);
        try {
          const documentIds = data.files.map((f) => f.id);
          // Use data.batchId directly (not the state var above) —
          // setState is async, so the state value isn't guaranteed
          // to be updated yet on this same tick.
          const sessionData = await createSession(
            documentIds,
            data.batchId,
            token,
          );
          setCurrentSessionId(sessionData.session.id);
          setCurrentSessionTitle(sessionData.session.title || null);
          if (onSessionSaved) onSessionSaved();
        } catch (saveErr) {
          console.warn("Session save failed (non-blocking):", saveErr.message);
        } finally {
          setIsTitleLoading(false);
        }
      }
    } catch (err) {
      setError(
        err.response?.data?.message || "Upload failed. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return {
    files,
    needsProcessing,
    loading,
    isDragging,
    addFiles,
    handleFilesChange,
    removeFile,
    handleUpload,
    handleDragEnter,
    handleDragLeave,
    handleDragOver,
    handleDrop,
    setFiles,
    setNeedsProcessing,
  };
}