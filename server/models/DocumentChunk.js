// ============================================================
// DocumentChunk.js
//
// WHAT THIS REPRESENTS:
// One embedded chunk of text from an uploaded document. This
// is the collection MongoDB Atlas Vector Search will query
// against — the vector index gets created on the `embedding`
// field here (that's Step 3, done manually in Atlas next).
//
// WHY A SEPARATE COLLECTION FROM Session:
// Uploads happen before we know whether the user is logged in
// or will ever save a session. Chunks need to exist in MongoDB
// the moment ANY upload happens — Atlas Vector Search can't
// search in-memory data. Session stays the permanent "saved
// history" record; DocumentChunk is the searchable knowledge
// layer underneath it.
//
// LIFECYCLE (permanent + TTL):
// - On upload: chunks are written with permanent:false.
// - If the user is logged in and saves a session, those chunks
//   flip to permanent:true and get linked via sessionId — see
//   sessionController.js createSession().
// - Chunks that stay permanent:false (anonymous uploads, or
//   uploads that never got saved) auto-delete after 24 hours
//   via the TTL index below, so abandoned uploads don't grow
//   the database forever.
// ============================================================

import mongoose from "mongoose";

const documentChunkSchema = new mongoose.Schema(
  {
    batchId: { type: String, required: true, index: true },
    documentId: { type: String, required: true },
    fileName: { type: String, required: true },
    mimetype: { type: String, required: true },
    chunkIndex: { type: Number, required: true },
    text: { type: String, required: true },
    embedding: { type: [Number], required: true },

    // Set true once a logged-in user saves this batch as a
    // Session — see sessionController.js createSession().
    permanent: { type: Boolean, default: false },
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Session",
      default: null,
    },
  },
  { timestamps: true }
);

// TTL cleanup — only applies to chunks still marked permanent:false.
// The partial filter means permanent (saved) chunks are never
// touched by this — only abandoned/anonymous uploads expire.
documentChunkSchema.index(
  { createdAt: 1 },
  { expireAfterSeconds: 86400, partialFilterExpression: { permanent: false } }
);

const DocumentChunk = mongoose.model("DocumentChunk", documentChunkSchema);

export default DocumentChunk;