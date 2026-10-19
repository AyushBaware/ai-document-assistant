// Purpose: Splits extracted document text into embedding-ready chunks.

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