// ======================================================
// KNOWLEDGE STORE
// In-memory document store — foundation of RAG pipeline.
// Each document is stored with its chunks and metadata.
// Future upgrade: replace with MongoDB + vector DB.
// ======================================================

const knowledgeStore = {
  documents: [],

  // Add a single processed document
  addDocument(document) {
    this.documents.push(document);
  },

  // Get all stored documents
  getAllDocuments() {
    return this.documents;
  },

  // IMPORTANT: Call this on every new upload session
  // Prevents old documents from polluting new responses
  clearDocuments() {
    this.documents = [];
  },

  // Check if store has any documents
  hasDocuments() {
    return this.documents.length > 0;
  },

  // Get total character count across all docs
  // Used for smart processing decisions
  getTotalLength() {
    return this.documents.reduce(
      (total, doc) => total + (doc.extractedText?.length || 0),
      0
    );
  },
};

export default knowledgeStore;