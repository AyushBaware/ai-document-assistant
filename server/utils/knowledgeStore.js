// ======================================================
// KNOWLEDGE STORE (Optimized for RAG Drop-In Continuity)
// In-memory document store — foundation of RAG pipeline.
// ======================================================

import { retrieveRelevantChunks } from "./retrieveChunks.js";

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

    const filter =
      selectedIds.length > 0 ? { documentId: { $in: selectedIds } } : {};

    return retrieveRelevantChunks(filter, query, apiKey, options.k || 6);
  }
};

export default knowledgeStore;