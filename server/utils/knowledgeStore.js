// ======================================================
// KNOWLEDGE STORE (Optimized for RAG Drop-In Continuity)
// In-memory document store — foundation of RAG pipeline.
// ======================================================

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
   * Semantic Retrieval Interface (RAG Readiness Layer)
   * Right now, it returns the structured document text matching selectedIds.
   * Later, replace this logic with vector database embeddings and cosine similarity search.
   */
  async retrieveContext(selectedIds = [], query = "", options = { k: 4 }) {
    const targets = selectedIds.length > 0 
      ? this.documents.filter(d => selectedIds.includes(d.id))
      : this.documents;

    if (targets.length === 0) return [];

    // Current logic: Whole-document processing (Deterministic baseline)
    // Future RAG logic: Generate query embedding -> Query Vector Store -> Filter by target IDs -> Return top K chunks
    return targets.map((doc, i) => ({
      id: doc.id,
      fileName: doc.fileName,
      textPayload: doc.extractedText || ""
    }));
  }
};

export default knowledgeStore;