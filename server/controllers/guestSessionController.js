// ============================================================
// guestSessionController.js
//
// Four endpoints supporting anonymous session continuity:
//   POST   /api/guest-session          → save/update in-progress guest work
//   GET    /api/guest-session          → fetch it back (refresh/reopen)
//   DELETE /api/guest-session          → discard it ("Start Fresh")
//   POST   /api/guest-session/convert  → turn it into a real, permanent
//                                        Session once the user logs in
// ============================================================

import PendingGuestSession from "../models/PendingGuestSession.js";
import Session from "../models/Session.js";
import DocumentChunk from "../models/DocumentChunk.js";
import knowledgeStore from "../utils/knowledgeStore.js";
import { generateSessionTitle, enforceSessionLimit } from "../utils/sessionHelpers.js";

export const saveGuestSession = async (req, res) => {
  try {
    if (req.userId) {
      // Logged-in users already get real sessions — nothing to stage.
      return res.status(200).json({ success: true, skipped: true });
    }

    const { documents, selectedIds, batchId, chatHistory } = req.body;

    if (!Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({ success: false, message: "No documents provided." });
    }

    await PendingGuestSession.findOneAndUpdate(
      { deviceId: req.deviceId },
      {
        $set: {
          documents,
          selectedIds: Array.isArray(selectedIds) ? selectedIds : [],
          batchId: batchId || null,
          chatHistory: Array.isArray(chatHistory) ? chatHistory : [],
          updatedAt: new Date(),
        },
      },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Save Guest Session Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to save progress." });
  }
};

export const getGuestSession = async (req, res) => {
  try {
    const pending = await PendingGuestSession.findOne({ deviceId: req.deviceId }).lean();
    if (!pending) {
      return res.status(200).json({ success: true, session: null });
    }
    return res.status(200).json({
      success: true,
      session: {
        documents: pending.documents,
        selectedIds: pending.selectedIds,
        batchId: pending.batchId,
        chatHistory: pending.chatHistory,
      },
    });
  } catch (error) {
    console.error("Get Guest Session Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch progress." });
  }
};

export const clearGuestSession = async (req, res) => {
  try {
    await PendingGuestSession.deleteOne({ deviceId: req.deviceId });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Clear Guest Session Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to clear progress." });
  }
};

// SECURITY NOTE: reads the pending record by deviceId (not by any
// value the client sends), and requireAuth guarantees req.userId is
// a genuine logged-in user — so this can never attach someone else's
// staged documents to your account.
export const convertGuestSession = async (req, res) => {
  try {
    const userId = req.userId;
    const pending = await PendingGuestSession.findOne({ deviceId: req.deviceId });

    if (!pending || !pending.documents || pending.documents.length === 0) {
      return res.status(404).json({ success: false, message: "No previous guest session found." });
    }

    // knowledgeStore only has the CURRENT server process's most recent
    // batch — same limitation documented for every other feature that
    // reads from it. If it's gone (server restarted, or a different
    // upload ran since), fail gracefully instead of creating an empty
    // session.
    const allDocuments = knowledgeStore.getAllDocuments();
    const idSet = new Set(pending.documents.map((d) => d.id));
    const matchedDocuments = allDocuments.filter((doc) => idSet.has(doc.id));

    if (matchedDocuments.length === 0) {
      await PendingGuestSession.deleteOne({ deviceId: req.deviceId });
      return res.status(410).json({
        success: false,
        message: "Your previous session has expired and can no longer be restored.",
      });
    }

    const title = generateSessionTitle(matchedDocuments.map((d) => d.fileName));

    const session = await Session.create({
      userId,
      title,
      titleSource: "fallback",
      batchId: pending.batchId || null,
      documents: matchedDocuments.map((doc) => ({
        fileName: doc.fileName,
        displayName: doc.displayName || doc.fileName,
        mimetype: doc.mimetype,
        extractedText: doc.extractedText,
        chunkCount: doc.chunkCount || (doc.chunks ? doc.chunks.length : 0),
      })),
      responses: { summary: {}, notes: {}, explain: {} },
      chatHistory: pending.chatHistory || [],
    });

    if (pending.batchId) {
      try {
        await DocumentChunk.updateMany(
          { batchId: pending.batchId, permanent: false },
          { $set: { permanent: true, sessionId: session._id } }
        );
      } catch (linkErr) {
        console.warn("Failed to link chunks to converted session (non-blocking):", linkErr.message);
      }
    }

    await enforceSessionLimit(userId);
    await PendingGuestSession.deleteOne({ deviceId: req.deviceId });

    return res.status(201).json({
      success: true,
      session: { id: session._id, title: session.title },
    });
  } catch (error) {
    console.error("Convert Guest Session Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to save your previous session." });
  }
};