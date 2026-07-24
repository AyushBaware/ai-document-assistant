// ============================================================
// useGuestSessionSync.js
//
// For anonymous users only: restores in-progress work (docs,
// chat, AND any already-generated Summary/Notes/Explain results)
// once on mount if a pending guest session exists, and keeps it
// all updated in the background as they keep working — so a
// refresh, tab close, or login never loses what was generated.
// Does nothing at all once `user` is set.
// ============================================================

import { useEffect, useRef } from "react";
import { saveGuestSession, getGuestSession } from "../api/guestSessionApi";

// cachedResults lives in UploadBox as an object keyed by cache key
// (e.g. "summary_id1,id2" -> { result, glossary, sourceFileNames }).
// The backend stores it as an array instead (cleaner for Mongoose
// schema validation) — these two helpers convert between the shapes.
const cachedResultsToArray = (cachedResults = {}) =>
  Object.entries(cachedResults).map(([key, value]) => ({
    key,
    type: key.split("_")[0],
    result: value.result,
    glossary: value.glossary || [],
    sourceFileNames: value.sourceFileNames || [],
  }));

const cachedResultsToObject = (entries = []) => {
  const obj = {};
  entries.forEach((entry) => {
    obj[entry.key] = {
      result: entry.result,
      glossary: entry.glossary || [],
      sourceFileNames: entry.sourceFileNames || [],
    };
  });
  return obj;
};

export function useGuestSessionSync({
  user,
  isProcessed,
  processedDocs,
  selectedIds,
  currentBatchId,
  preloadedChatHistory,
  cachedResults,
  setProcessedDocs,
  setProcessedFileNames,
  setSelectedIds,
  setIsProcessed,
  setNeedsProcessing,
  setCurrentBatchId,
  setPreloadedChatHistory,
  setCachedResults,
  setShowChat,
}) {
  const hasRestored = useRef(false);

  useEffect(() => {
    if (user || hasRestored.current) return;
    hasRestored.current = true;

    (async () => {
      try {
        const data = await getGuestSession();
        const session = data?.session;
        if (!session || !session.documents || session.documents.length === 0) return;

        setProcessedDocs(session.documents);
        setProcessedFileNames(
          session.documents.map((d) => d.displayName || d.fileName)
        );
        setSelectedIds(
          session.selectedIds && session.selectedIds.length > 0
            ? session.selectedIds
            : session.documents.map((d) => d.id)
        );
        setIsProcessed(true);
        setNeedsProcessing(false);
        setCurrentBatchId(session.batchId || null);
        setPreloadedChatHistory(session.chatHistory || []);
        setCachedResults(cachedResultsToObject(session.cachedResults || []));
        setShowChat(true);
      } catch {
        // Non-blocking — restoring past guest work is a convenience.
      }
    })();
  }, [user]);

  useEffect(() => {
    if (user || !isProcessed || processedDocs.length === 0) return;

    saveGuestSession({
      documents: processedDocs,
      selectedIds,
      batchId: currentBatchId,
      chatHistory: preloadedChatHistory,
      cachedResults: cachedResultsToArray(cachedResults),
    }).catch(() => {
      // Non-blocking.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isProcessed, processedDocs, currentBatchId, preloadedChatHistory, cachedResults]);
}