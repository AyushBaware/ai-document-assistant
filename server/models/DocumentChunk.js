// Purpose: Defines the MongoDB schema for embedded document chunks.

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

    // SHA-256 of the source document's full extracted text.
    // Lets uploadController detect "this exact file was already
    // embedded before" and skip a redundant Gemini API call —
    // a real quota saver for repeat uploads during testing/study.
    contentHash: { type: String, index: true },

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