// ============================================================
// useGuestSessionSync.js
//
// For anonymous users only: restores in-progress work (docs +
// chat) once on mount if a pending guest session exists, and
// keeps it updated in the background as they keep chatting —
// so a refresh, tab close, or navigating away never loses it.
// Does nothing at all once `user` is set.
// ============================================================

import { useEffect, useRef } from "react";
import { saveGuestSession, getGuestSession } from "../api/guestSessionApi";

export function useGuestSessionSync({
  user,
  isProcessed,
  processedDocs,
  selectedIds,
  currentBatchId,
  preloadedChatHistory,
  setProcessedDocs,
  setProcessedFileNames,
  setSelectedIds,
  setIsProcessed,
  setNeedsProcessing,
  setCurrentBatchId,
  setPreloadedChatHistory,
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
    }).catch(() => {
      // Non-blocking.
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isProcessed, processedDocs, currentBatchId, preloadedChatHistory]);
}