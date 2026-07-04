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
    mimetype: { type: String, required: true },
    extractedText: { type: String, required: true },
    chunkCount: { type: Number, default: 0 },
  },
  { _id: false } // sub-documents don't need their own _id here
);

const responseSubSchema = new mongoose.Schema(
  {
    result: { type: String, default: null },
    generatedAt: { type: Date, default: null },
    tokenBudget: { type: Number, default: null }, // useful for debugging/analytics later
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
    responses: {
      summary: { type: responseSubSchema, default: () => ({}) },
      notes: { type: responseSubSchema, default: () => ({}) },
      explain: { type: responseSubSchema, default: () => ({}) },
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