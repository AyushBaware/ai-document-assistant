// ======================================================
// CREATE CHUNKS
// Splits document text into semantic segments.
// RAG CONCEPT: Instead of sending the entire document
// to Gemini every time, we break it into chunks so
// later we can retrieve ONLY the relevant ones.
// Chunk size = 6000 chars (~1500 tokens) — large enough
// to hold meaningful content, small enough to be precise.
// ======================================================

const CHUNK_SIZE = 6000;
const CHUNK_OVERLAP = 200; // Overlap prevents cutting mid-concept

export const createChunks = (text) => {
  if (!text) return [];

  // Clean excessive whitespace but preserve paragraph breaks
  const cleanText = text
    .replace(/[ \t]+/g, " ")      // collapse spaces/tabs
    .replace(/\n{3,}/g, "\n\n")   // max 2 newlines
    .trim();

  if (cleanText.length <= CHUNK_SIZE) {
    return [cleanText]; // Small doc — no chunking needed
  }

  const chunks = [];
  let start = 0;

  while (start < cleanText.length) {
    const end = Math.min(start + CHUNK_SIZE, cleanText.length);
    chunks.push(cleanText.slice(start, end));
    start += CHUNK_SIZE - CHUNK_OVERLAP; // Slide with overlap
  }

  return chunks;
};