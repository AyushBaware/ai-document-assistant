// ======================================================
// KNOWLEDGE STORE (Optimized for RAG Drop-In Continuity)
// In-memory document store — foundation of RAG pipeline.
// ======================================================

import { retrieveRelevantChunks, retrieveRelevantChunksPerDocument } from "./retrieveChunks.js";

const knowledgeStore = {
  documents: [],

  addDocument(document) {
    this.documents.push(document);
  },

  getAllDocuments() {
    return this.documents;
  },

  clearDocuments() {
    this.documents = [];
  },

  hasDocuments() {
    return this.documents.length > 0;
  },

  getTotalLength() {
    return this.documents.reduce(
      (total, doc) => total + (doc.extractedText?.length || 0),
      0
    );
  },

  /**
   * Semantic Retrieval (real implementation)
   * Embeds `query` and runs MongoDB Atlas Vector Search against
   * the DocumentChunk collection, scoped to the given documentIds
   * (or the whole current upload batch if selectedIds is empty).
   * Requires the Gemini API key so it can embed the query text.
   */
  async retrieveContext(selectedIds = [], query = "", apiKey = "", options = { k: 6 }) {
    if (!query || !apiKey) return [];

    // Multiple documents selected — balanced per-document retrieval
    // guarantees every one of them contributes chunks, instead of a
    // single global top-k that one document's closer-matching
    // chunks could dominate entirely.
    if (selectedIds.length > 1) {
      const kPerDoc = Math.max(2, Math.ceil((options.k || 6) / selectedIds.length));
      const docFilters = selectedIds.map((id) => ({ documentId: id }));
      return retrieveRelevantChunksPerDocument(docFilters, query, apiKey, kPerDoc);
    }

    const filter =
      selectedIds.length > 0 ? { documentId: { $in: selectedIds } } : {};

    return retrieveRelevantChunks(filter, query, apiKey, options.k || 6);
  }
};

export default knowledgeStore;