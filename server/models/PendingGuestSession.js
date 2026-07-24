// ============================================================
// PendingGuestSession.js
//
// Temporary holding place for an ANONYMOUS user's in-progress
// work — which documents they uploaded (by reference, not full
// text) and the chat exchanged so far. Keyed by deviceId (the
// same httpOnly cookie used for the API key and guest limit),
// so it survives refreshes, tab closes, and reopens.
//
// This is intentionally NOT permanent storage — it exists only
// to bridge "anonymous work" to "saved account session" at the
// moment of login, or to restore an in-progress guest session
// after a refresh. It self-deletes 24h after last activity via
// the TTL index below, same pattern as DocumentChunk's TTL.
// ============================================================

import mongoose from "mongoose";

const guestDocumentSubSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    fileName: { type: String, required: true },
    displayName: { type: String, default: null },
    mimetype: { type: String, required: true },
    chunkCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const guestChatMessageSubSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    sources: { type: [String], default: [] },
  },
  { _id: false }
);

const guestGlossaryTermSubSchema = new mongoose.Schema(
  {
    term: { type: String, required: true },
    definition: { type: String, required: true },
  },
  { _id: false }
);

// One entry per generated Summary/Notes/Explain result — `key` matches
// the exact cache key UploadBox already uses (e.g. "summary_id1,id2"),
// so restoring it back into cachedResults on reload is a direct match,
// no recomputation needed.
const guestCachedResultSubSchema = new mongoose.Schema(
  {
    key: { type: String, required: true },
    type: { type: String, enum: ["summary", "notes", "explain"], required: true },
    result: { type: String, required: true },
    glossary: { type: [guestGlossaryTermSubSchema], default: [] },
    sourceFileNames: { type: [String], default: [] },
  },
  { _id: false }
);

const pendingGuestSessionSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, unique: true, index: true },
    batchId: { type: String, default: null },
    documents: { type: [guestDocumentSubSchema], default: [] },
    selectedIds: { type: [String], default: [] },
    chatHistory: { type: [guestChatMessageSubSchema], default: [] },
    cachedResults: { type: [guestCachedResultSubSchema], default: [] },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

pendingGuestSessionSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 86400 });

const PendingGuestSession = mongoose.model("PendingGuestSession", pendingGuestSessionSchema);

export default PendingGuestSession;