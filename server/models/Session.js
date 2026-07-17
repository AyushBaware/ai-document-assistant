// ============================================================
// Session.js
//
// WHAT THIS REPRESENTS:
// One "session" = one upload batch (the documents the user
// processed together) + whatever AI responses were generated
// for them. This mirrors how your UploadBox.jsx already works
// — you upload a set of files, then click Summary/Notes/Explain
// on that same set. A session captures that entire unit.
//
// WHY THIS SHAPE AND NOT "ONE DOCUMENT PER RESPONSE"?
// If we saved each response as its own flat document, a user
// who uploaded 2 PDFs and generated all 3 modes would create
// 3 separate DB entries that don't know about each other. By
// nesting responses INSIDE the session, opening one session
// shows everything generated for that exact upload — Summary,
// Notes, AND Explain together, just like the UI already groups
// them per upload.
//
// THE FORWARD-COMPATIBLE PART (for RAG):
// Chunk-level embeddings live in the separate DocumentChunk
// collection (see models/DocumentChunk.js), linked back here
// via batchId. Session itself only stores the full extractedText
// per document (for the existing Summary/Notes/Explain flow) —
// it doesn't duplicate embeddings, keeping this schema small.
// ============================================================

import mongoose from "mongoose";

const documentSubSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true },
    displayName: { type: String, default: null },
    mimetype: { type: String, required: true },
    extractedText: { type: String, required: true },
    chunkCount: { type: Number, default: 0 },
  },
  { _id: false }
);

const glossaryTermSubSchema = new mongoose.Schema(
  {
    term: { type: String, required: true },
    definition: { type: String, required: true },
  },
  { _id: false }
);

const responseSubSchema = new mongoose.Schema(
  {
    result: { type: String, default: null },
    generatedAt: { type: Date, default: null },
    tokenBudget: { type: Number, default: null }, // useful for debugging/analytics later
    glossary: { type: [glossaryTermSubSchema], default: [] },
  },
  { _id: false }
);

// Stores a Summary/Notes/Explain result generated from a SPECIFIC subset
// of the session's documents (via the checkbox filter). Kept separate
// from responseSubSchema above so the existing single-slot "full session"
// responses stay untouched and backward-compatible — this array only
// ever holds additional, selection-scoped results.
const scopedResponseSubSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["summary", "notes", "explain"], required: true },
    fileNames: { type: [String], required: true }, // exact file set this result came from
    result: { type: String, required: true },
    generatedAt: { type: Date, default: Date.now },
    tokenBudget: { type: Number, default: null },
    glossary: { type: [glossaryTermSubSchema], default: [] },
  },
  { _id: false }
);

const chatMessageSubSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["user", "assistant"], required: true },
    content: { type: String, required: true },
    sources: { type: [String], default: [] }, // fileNames the answer was grounded in
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const sessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true, // speeds up "find all sessions for this user" queries
    },

    // Auto-generated from document names — shown in the
    // history sidebar so the user recognizes the session
    // without opening it.
    title: {
      type: String,
      required: true,
    },

    // Tracks whether this session's title came from Groq's
    // content-aware generation, or is still filename-based.
    // "default" = never attempted (old sessions before this
    // feature existed). "groq" = successfully smart-titled.
    // "fallback" = Groq was tried once and failed/skipped —
    // this LOCKS the session so getSessionById never retries
    // Groq on it again, no matter how many times it's reopened.
    titleSource: {
      type: String,
      enum: ["default", "groq", "fallback"],
      default: "default",
    },

    // Links back to the DocumentChunk batch created at upload
    // time — lets sessionController flip those chunks from
    // temporary to permanent once the user saves this session.
    batchId: {
      type: String,
      default: null,
    },

    documents: {
      type: [documentSubSchema],
      required: true,
    },

    // Fixed set of modes — matches your AI_MODES in UploadBox.jsx.
    // Each starts empty and fills in as the user clicks buttons.
    // Only ever populated by FULL-SESSION generations (all documents).
    responses: {
      summary: { type: responseSubSchema, default: () => ({}) },
      notes: { type: responseSubSchema, default: () => ({}) },
      explain: { type: responseSubSchema, default: () => ({}) },
    },

    // Populated whenever a generation used a SPECIFIC subset of this
    // session's documents (checkbox filter) — lets that exact result be
    // restored permanently when the user reselects the same subset later.
    scopedResponses: {
      type: [scopedResponseSubSchema],
      default: [],
    },

    // Persisted conversation for the "Ask Questions" feature —
    // only used for saved sessions (logged-in users). Anonymous
    // chat stays client-side only, sent back each request.
    chatHistory: {
      type: [chatMessageSubSchema],
      default: [],
    },

    lastOpenedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true, // adds createdAt + updatedAt automatically
  }
);

const Session = mongoose.model("Session", sessionSchema);

export default Session;