// Purpose: Stores and retrieves document chunks for the active upload batch.

import { retrieveRelevantChunks, retrieveRelevantChunksPerDocument } from "./retrieveChunks.js";

const MAX_BATCH_AGE_MS = 30 * 60 * 1000; // stale-batch safety net

const knowledgeStore = {
  batches: new Map(), // batchId -> { documents, createdAt }

  addBatch(batchId, documents) {
    this._evictStale();
    this.batches.set(batchId, { documents, createdAt: Date.now() });
  },

  getBatch(batchId) {
    return this.batches.get(batchId)?.documents || [];
  },

  _evictStale() {
    const cutoff = Date.now() - MAX_BATCH_AGE_MS;
    for (const [id, entry] of this.batches) {
      if (entry.createdAt < cutoff) this.batches.delete(id);
    }
  },

  async retrieveContext(selectedIds = [], query = "", apiKey = "", options = { k: 6 }) {
    if (!query || !apiKey) return [];

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