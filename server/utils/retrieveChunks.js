// ============================================================
// retrieveChunks.js
//
// WHAT THIS DOES:
// Given a natural-language query, finds the most semantically
// relevant chunks from DocumentChunk using MongoDB Atlas Vector
// Search ($vectorSearch aggregation stage).
//
// FLOW:
//   1. Embed the query text using RETRIEVAL_QUERY taskType
//      (different from RETRIEVAL_DOCUMENT used at upload time —
//      Gemini's embeddings are asymmetric, this pairing gives
//      measurably better retrieval accuracy).
//   2. Run $vectorSearch against the "vector_index" created in
//      Atlas, scoped by `filter` (e.g. only this document, only
//      this batch, only this session) so one user's search never
//      touches another user's chunks.
//   3. Return the top-k matches with their similarity score.
//
// NOT YET WIRED TO ANY ROUTE:
// This is infrastructure — nothing calls it yet. It becomes live
// once the "Ask Questions" chat feature (Phase 4, Step 6) sends
// user questions through it.
// ============================================================

import DocumentChunk from "../models/DocumentChunk.js";
import { embedTexts } from "./embedText.js";

const VECTOR_INDEX_NAME = "vector_index";

// filter examples:
//   { documentId: { $in: ["id1", "id2"] } }  → search specific documents
//   { batchId: "abc-123" }                    → search one upload batch
//   { sessionId: "mongoId" }                  → search one saved session
export const retrieveRelevantChunks = async (
  filter,
  queryText,
  apiKey,
  topK = 6
) => {
  if (!queryText || !queryText.trim()) return [];
  if (!apiKey) throw new Error("Gemini API key required for retrieval.");

  const [queryEmbedding] = await embedTexts(
    [queryText],
    apiKey,
    "RETRIEVAL_QUERY"
  );

  const results = await DocumentChunk.aggregate([
    {
      $vectorSearch: {
        index: VECTOR_INDEX_NAME,
        path: "embedding",
        queryVector: queryEmbedding,
        // numCandidates should be well above `limit` — Atlas docs
        // recommend ~10-20x the limit for good recall/speed balance.
        numCandidates: topK * 15,
        limit: topK,
        filter,
      },
    },
    {
      $project: {
        _id: 0,
        fileName: 1,
        documentId: 1,
        chunkIndex: 1,
        text: 1,
        score: { $meta: "vectorSearchScore" },
      },
    },
  ]);

  return results;
};

// ── BALANCED MULTI-DOCUMENT RETRIEVAL ──────────────────────────
// A single global $vectorSearch across several documents can starve
// out every document except whichever one's chunks happen to embed
// closest to the query — for a broad question like "explain both
// pdfs", one document can fill the entire top-k and the other is
// silently dropped, even though it was correctly selected. Fixed by
// running one $vectorSearch PER document (small k each) and merging
// the results, guaranteeing every selected document contributes.
export const retrieveRelevantChunksPerDocument = async (
  docFilters,
  queryText,
  apiKey,
  kPerDoc = 4
) => {
  if (!queryText || !queryText.trim()) return [];
  if (!apiKey) throw new Error("Gemini API key required for retrieval.");
  if (!docFilters || docFilters.length === 0) return [];

  const [queryEmbedding] = await embedTexts(
    [queryText],
    apiKey,
    "RETRIEVAL_QUERY"
  );

  const perDocResults = await Promise.all(
    docFilters.map((filter) =>
      DocumentChunk.aggregate([
        {
          $vectorSearch: {
            index: VECTOR_INDEX_NAME,
            path: "embedding",
            queryVector: queryEmbedding,
            numCandidates: kPerDoc * 15,
            limit: kPerDoc,
            filter,
          },
        },
        {
          $project: {
            _id: 0,
            fileName: 1,
            documentId: 1,
            chunkIndex: 1,
            text: 1,
            score: { $meta: "vectorSearchScore" },
          },
        },
      ])
    )
  );

  return perDocResults.flat();
};