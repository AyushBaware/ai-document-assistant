// ============================================================
// embedText.js
//
// WHAT THIS DOES:
// Converts chunks of text into embedding vectors using Gemini's
// embedding model. These vectors are what MongoDB Atlas Vector
// Search compares against to find semantically relevant chunks
// later (retrieval).
//
// MODEL UPDATE (important):
// text-embedding-004 was shut down by Google on Jan 14, 2026.
// gemini-embedding-001 is the replacement. Its native output is
// 3072 dimensions, but we explicitly request 768 dimensions via
// outputDimensionality — this keeps our Atlas Vector Search index
// small and fast, and 768 dims is still highly accurate for
// document retrieval at this project's scale.
//
// WHY BATCH INSTEAD OF ONE CALL PER CHUNK:
// Gemini's batchEmbedContents endpoint embeds up to 100 pieces
// of text in a SINGLE API call. Calling embedContent once per
// chunk would burn through a user's free-tier quota far faster
// for zero benefit — batching is both faster and cheaper.
//
// TASK TYPE:
// Gemini embeddings support a "taskType" hint that improves
// retrieval accuracy:
//   RETRIEVAL_DOCUMENT → used here, when embedding documents
//                         to be searched (at upload time)
//   RETRIEVAL_QUERY     → used later when embedding a user's
//                         search/chat question
// Using the correct type on each side measurably improves
// which chunks get retrieved — that's why this is a parameter,
// not hardcoded.
// ============================================================

const EMBEDDING_MODEL = "gemini-embedding-001";
const EMBEDDING_URL = `https://generativelanguage.googleapis.com/v1beta/models/${EMBEDDING_MODEL}:batchEmbedContents`;

// Must match the "numDimensions" set in the Atlas Vector Search
// index (vector_index) — changing this requires recreating the
// index, since vector dimensions can't be changed after creation.
const EMBEDDING_DIMENSIONS = 768;

// Gemini's batch endpoint caps requests per call. Splitting our
// own request list keeps us under that ceiling regardless of
// how many chunks a large multi-file upload produces.
const MAX_PER_BATCH = 100;

const embedBatch = async (texts, apiKey, taskType) => {
  const requests = texts.map((text) => ({
    model: `models/${EMBEDDING_MODEL}`,
    content: { parts: [{ text }] },
    taskType,
    outputDimensionality: EMBEDDING_DIMENSIONS,
  }));

  const response = await fetch(EMBEDDING_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({ requests }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[Embed] API error:", JSON.stringify(data, null, 2));
    throw new Error(data.error?.message || "Gemini embedding request failed");
  }

  return data.embeddings.map((e) => e.values);
};

// ── PUBLIC: embed an array of text chunks, preserving order ───
// Splits into MAX_PER_BATCH-sized groups, calls Gemini once per
// group, and flattens results back into one array whose index
// lines up exactly with the input `texts` array.
export const embedTexts = async (
  texts,
  apiKey,
  taskType = "RETRIEVAL_DOCUMENT"
) => {
  if (!texts || texts.length === 0) return [];

  const groups = [];
  for (let i = 0; i < texts.length; i += MAX_PER_BATCH) {
    groups.push(texts.slice(i, i + MAX_PER_BATCH));
  }

  const groupResults = await Promise.all(
    groups.map((group) => embedBatch(group, apiKey, taskType))
  );

  return groupResults.flat();
};