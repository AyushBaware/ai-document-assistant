import { useState, useEffect } from "react";
import { getSessionById } from "../api/sessionApi";

// ============================================================
// useSessionLoader.js
//
// Loads a past session — either because App.jsx's history
// sidebar handed down a `preloadedSession` id, or because the
// user clicked a session in UploadBox's own desktop sidebar
// (loadSessionById is called directly in that case).
//
// Loading a session repopulates the same shared state that a
// fresh upload would populate, so it needs the same set of
// setters passed down from UploadBox.
// ============================================================
export function useSessionLoader({
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
}) {
  const [isLoadingPreload, setIsLoadingPreload] = useState(false);

  // Loads any past session into the current view — used both when
  // App.jsx passes a `preloadedSession` id (mobile history sidebar) and
  // when a session is clicked directly from the desktop sidebar.
  const loadSessionById = async (sessionId) => {
    try {
      setIsLoadingPreload(true);
      setError("");

      const data = await getSessionById(sessionId, token);
      const session = data.session;

      setCurrentSessionId(session.id);
      setCurrentSessionTitle(session.title || null);
      setProcessedDocs(
        session.documents.map((d, i) => ({
          id: `preloaded-${i}`,
          fileName: d.fileName,
          displayName: d.displayName || d.fileName,
          mimetype: d.mimetype,
          chunkCount: d.chunkCount,
        })),
      );
      setProcessedFileNames(
        session.documents.map((d) => d.displayName || d.fileName),
      );
      setSelectedIds(session.documents.map((_, i) => `preloaded-${i}`));
      setIsProcessed(true);
      setNeedsProcessing(false);
      setFiles([]);

      const preloadedCache = {};
      ["summary", "notes", "explain"].forEach((type) => {
        if (session.responses?.[type]?.result) {
          const cacheKey = `${type}_${session.documents
            .map((_, i) => `preloaded-${i}`)
            .sort()
            .join(",")}`;
          preloadedCache[cacheKey] = {
            result: session.responses[type].result,
            glossary: session.responses[type].glossary || [],
          };
        }
      });
      setCachedResults(preloadedCache);
      setAiResult("");
      setGlossary([]);
      setActiveMode(null);

      const savedMessages = (session.chatHistory || []).map((m) => ({
        role: m.role,
        content: m.content,
        sources: m.sources || [],
      }));
      setPreloadedChatHistory(savedMessages);

      // Land directly in the full-screen view, same as a fresh upload.
      setShowChat(true);
      setMenuOpen(false);
    } catch (err) {
      setError("Failed to load this session.");
    } finally {
      setIsLoadingPreload(false);
    }
  };

  // ── LOAD A PRELOADED SESSION (from App.jsx's mobile history sidebar) ──
  useEffect(() => {
    if (!preloadedSession) return;
    loadSessionById(preloadedSession);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preloadedSession]);

  return { isLoadingPreload, loadSessionById };
}