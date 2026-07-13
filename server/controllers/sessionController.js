// ============================================================
// sessionController.js
//
// ARCHITECTURE NOTE (Phase 3 design decision):
// createSession does NOT receive extractedText from the
// frontend. uploadController.js intentionally strips that
// field from its response to keep the upload payload light —
// the browser never needs to hold 50,000+ characters of raw
// document text just to display it.
//
// Instead, the frontend sends only DOCUMENT IDS (the same ids
// used for the checkbox selection in UploadBox.jsx). The
// backend then pulls the actual extractedText from
// knowledgeStore.js — which already has it in memory from the
// upload step that just ran. This avoids a wasteful round-trip
// AND prevents a tampered frontend request from injecting fake
// content directly into MongoDB.
//
// TRADEOFF: knowledgeStore is in-memory and per-server-process.
// This works correctly for a single-server local/dev setup
// (your current architecture). If you later deploy with
// multiple server instances behind a load balancer, in-memory
// storage breaks (request might land on a different instance
// than the upload did). That's a known limitation documented
// here for when Phase 7 (deployment) is reached — the fix then
// would be moving knowledgeStore into Redis or directly into
// MongoDB as a temporary "pending documents" collection.
// ============================================================

import Session from "../models/Session.js";
import DocumentChunk from "../models/DocumentChunk.js";
import knowledgeStore from "../utils/knowledgeStore.js";
import { generateSessionTitle, enforceSessionLimit } from "../utils/sessionHelpers.js";
import { generateSmartTitle } from "../utils/groqTitle.js";

// ============================================================
// POST /api/sessions
// Frontend sends: { documentIds: ["id1", "id2"] }
// Backend looks these up in knowledgeStore (populated during
// the upload that just happened) and saves the full session.
// ============================================================

export const createSession = async (req, res) => {
  try {
    const { documentIds, batchId } = req.body;
    const userId = req.userId;

    if (!documentIds || !Array.isArray(documentIds) || documentIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No document IDs provided to save.",
      });
    }

    const allDocuments = knowledgeStore.getAllDocuments();
    const idSet = new Set(documentIds);
    const matchedDocuments = allDocuments.filter((doc) => idSet.has(doc.id));

    if (matchedDocuments.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Documents not found. Please re-upload and try again.",
      });
    }

    // Sample the LARGEST document for title generation — the most
    // likely "primary" file in a multi-doc session, and keeps the
    // Groq prompt small instead of diluting it across every file.
    const primaryDoc = matchedDocuments.reduce((largest, doc) =>
      (doc.extractedText?.length || 0) > (largest.extractedText?.length || 0)
        ? doc
        : largest
    , matchedDocuments[0]);

    // Best-effort smart title — fully isolated from Gemini. ANY
    // failure (timeout, rate limit, bad key) returns null and we
    // fall straight back to the filename-based title. This can
    // never block or break session creation.
    const smartTitle = await generateSmartTitle(primaryDoc.extractedText);
    const title = smartTitle || generateSessionTitle(matchedDocuments.map((d) => d.fileName));
    const titleSource = smartTitle ? "groq" : "fallback";

    const session = await Session.create({
      userId,
      title,
      titleSource,
      batchId: batchId || null,
      documents: matchedDocuments.map((doc) => ({
        fileName: doc.fileName,
        displayName: doc.displayName || doc.fileName,
        mimetype: doc.mimetype,
        extractedText: doc.extractedText,
        chunkCount: doc.chunkCount || (doc.chunks ? doc.chunks.length : 0),
      })),
      responses: {
        summary: {},
        notes: {},
        explain: {},
      },
    });

    // Promote this batch's chunks from temporary to permanent so
    // the 24h TTL cleanup (DocumentChunk.js) never deletes them —
    // this session now owns them for as long as it exists.
    if (batchId) {
      try {
        await DocumentChunk.updateMany(
          { batchId, permanent: false },
          { $set: { permanent: true, sessionId: session._id } }
        );
      } catch (linkErr) {
        // Non-blocking — the session itself saved fine; worst
        // case this batch's chunks expire in 24h and semantic
        // search on this session won't work until re-uploaded.
        console.warn("Failed to link chunks to session (non-blocking):", linkErr.message);
      }
    }

    await enforceSessionLimit(userId);

    return res.status(201).json({
      success: true,
      session: {
        id: session._id,
        title: session.title,
        createdAt: session.createdAt,
      },
    });

  } catch (error) {
    console.error("Create Session Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to save session.",
    });
  }
};

// ============================================================
// GET /api/sessions
// Lightweight list for the sidebar — title, dates, document
// names, and which AI modes already have cached responses.
// ============================================================

export const getAllSessions = async (req, res) => {
  try {
    const userId = req.userId;

    const sessions = await Session.find({ userId })
      .sort({ lastOpenedAt: -1 })
      .select("title createdAt lastOpenedAt documents.fileName responses")
      .lean();

    const sessionList = sessions.map((s) => ({
      id: s._id,
      title: s.title,
      createdAt: s.createdAt,
      lastOpenedAt: s.lastOpenedAt,
      documentNames: s.documents.map((d) => d.displayName || d.fileName),
      hasResponses: {
        summary: !!s.responses?.summary?.result,
        notes: !!s.responses?.notes?.result,
        explain: !!s.responses?.explain?.result,
      },
    }));

    return res.status(200).json({
      success: true,
      sessions: sessionList,
    });

  } catch (error) {
    console.error("Get All Sessions Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch sessions.",
    });
  }
};

// ============================================================
// GET /api/sessions/:id
// Full session detail. Security check: filters by userId too,
// so users can never fetch another user's session by guessing
// the MongoDB _id in the URL.
// ============================================================

export const getSessionById = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const session = await Session.findOne({ _id: id, userId });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    session.lastOpenedAt = new Date();

    // Retroactive title fix — runs EXACTLY ONCE per session. Old
    // sessions from before this feature still have titleSource
    // "default" (the schema default). The first time such a
    // session is reopened, we try Groq once and lock the outcome
    // — success OR failure — so reopening the same old session
    // again never re-triggers Groq, never re-rolls the title, and
    // never spends quota on it a second time.
    if (session.titleSource === "default") {
      try {
        const primaryDoc = session.documents.reduce((largest, doc) =>
          (doc.extractedText?.length || 0) > (largest.extractedText?.length || 0)
            ? doc
            : largest
        , session.documents[0]);

        const smartTitle = primaryDoc
          ? await generateSmartTitle(primaryDoc.extractedText)
          : null;

        if (smartTitle) {
          session.title = smartTitle;
          session.titleSource = "groq";
        } else {
          session.titleSource = "fallback"; // lock — never retry
        }
      } catch (titleErr) {
        console.warn("Retroactive title fix failed (non-blocking):", titleErr.message);
        session.titleSource = "fallback"; // still lock
      }
    }

    await session.save();

    return res.status(200).json({
      success: true,
      session: {
        id: session._id,
        title: session.title,
        documents: session.documents,
        responses: session.responses,
        chatHistory: session.chatHistory,
        createdAt: session.createdAt,
      },
    });

  } catch (error) {
    console.error("Get Session By Id Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch session.",
    });
  }
};

// ============================================================
// PATCH /api/sessions/:id
// Saves an AI response (summary/notes/explain) into the session.
// ============================================================

export const updateSessionResponse = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;
    const { type, result, tokenBudget, glossary } = req.body;

    if (!type || !["summary", "notes", "explain"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid response type.",
      });
    }

    if (!result) {
      return res.status(400).json({
        success: false,
        message: "No result provided to save.",
      });
    }

    const session = await Session.findOne({ _id: id, userId });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    session.responses[type] = {
      result,
      generatedAt: new Date(),
      tokenBudget: tokenBudget || null,
      glossary: Array.isArray(glossary) ? glossary.slice(0, 20) : [],
    };

    await session.save();

    return res.status(200).json({
      success: true,
      message: `${type} response saved.`,
    });

  } catch (error) {
    console.error("Update Session Response Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to save response.",
    });
  }
};

// ============================================================
// DELETE /api/sessions/:id
// ============================================================

export const deleteSession = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    const session = await Session.findOneAndDelete({ _id: id, userId });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Session deleted.",
    });

  } catch (error) {
    console.error("Delete Session Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to delete session.",
    });
  }
};