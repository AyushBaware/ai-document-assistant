// WHAT THIS DOES:
// Generates a smart, content-aware session title using Groq's
// free-tier llama-3.1-8b-instant model — completely isolated
// from the Gemini pipeline (different API, different key,
// different provider). This file's only job is: given a
// document's extracted text, return a short title describing
// what the document is ABOUT, or null if anything goes wrong.
//
// WHY SPREAD-SAMPLING (not "first N words"):
// Real documents front-load metadata before real content —
// resumes start with a name/contact block, forms start with
// header fields, reports start with a cover page. Reading
// further into the START doesn't fix this; the fix is reading
// from multiple POINTS across the document (head + middle +
// tail), so the sample is very likely to include real body
// content no matter where the document places its metadata.
//
// WHY THIS NEVER BLOCKS OR BREAKS ANYTHING:
// - Hard 3-second timeout via AbortController
// - ANY failure (network, timeout, bad key, rate limit) simply
//   returns null — caller falls back to the existing filename-
//   based title. This function must NEVER throw.
// - Runs only in sessionController.js createSession(), which
//   already wraps title generation in a non-blocking try/catch.
//   It never touches the upload flow or the user-facing
//   response time.
// - Zero relationship to Gemini quota — different provider,
//   different key, tracked entirely separately.
// ============================================================

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.1-8b-instant";
const TIMEOUT_MS = 3000;

// How much text to pull from each position. ~500 chars each,
// ~1200-1500 chars total once joined — small enough to stay
// comfortably inside Groq's free-tier TPM budget per call.
const SLICE_SIZE = 500;

// For MULTI-document sessions, each doc gets a smaller slice
// (not the full spread-sample) so the combined prompt across
// several files still stays small — we only need enough per
// doc to identify its topic, not its full content.
const MULTI_DOC_SLICE_SIZE = 250;

// Caps how many documents get sampled for a combined title —
// keeps the prompt bounded even if someone uploads 8+ files.
const MAX_DOCS_FOR_TITLE_SAMPLE = 5;

// ── SPREAD-SAMPLING ────────────────────────────────────────────
// Pulls three slices from head, middle, and tail of the text so
// the sample very likely contains real subject-matter content
// even when the document's opening section is pure metadata
// (resume header, form fields, cover page, letterhead).
const buildSpreadSample = (text) => {
  if (!text) return "";

  // Strip the [SYSTEM NOTE: ...] suffix some extractors append —
  // it's a diagnostic message, not real document content, and
  // would otherwise pollute the tail slice.
  const clean = text.replace(/\[SYSTEM NOTE:[\s\S]*?\]/g, "").trim();

  if (clean.length <= SLICE_SIZE * 3) {
    // Short document — just use the whole thing, no need to slice.
    return clean;
  }

  const head = clean.slice(0, SLICE_SIZE);

  const midStart = Math.floor(clean.length / 2) - Math.floor(SLICE_SIZE / 2);
  const middle = clean.slice(midStart, midStart + SLICE_SIZE);

  const tail = clean.slice(clean.length - SLICE_SIZE);

  return (
    `[Opening]\n${head}\n\n` +
    `[Middle]\n${middle}\n\n` +
    `[Ending]\n${tail}`
  );
};

// ── MULTI-DOCUMENT SAMPLE ───────────────────────────────────────
// Builds one small labelled sample per document (instead of just
// reading the largest/first document) so a combined title can
// reflect ALL uploaded files, not just one of them.
const buildMultiDocSample = (documents) => {
  return documents
    .slice(0, MAX_DOCS_FOR_TITLE_SAMPLE)
    .map((doc, i) => {
      const clean = (doc.extractedText || "")
        .replace(/\[SYSTEM NOTE:[\s\S]*?\]/g, "")
        .trim();
      const sample = clean.slice(0, MULTI_DOC_SLICE_SIZE);
      return `[Document ${i + 1}: ${doc.fileName}]\n${sample}`;
    })
    .join("\n\n");
};

// ── RATE LIMIT VISIBILITY ──────────────────────────────────────
// Logs Groq's own account-specific rate-limit headers so you can
// watch real usage in your server console instead of trusting
// any published number (these change and vary by account).
const logRateLimitHeaders = (headers) => {
  const remainingReq = headers.get("x-ratelimit-remaining-requests");
  const limitReq = headers.get("x-ratelimit-limit-requests");
  const remainingTok = headers.get("x-ratelimit-remaining-tokens");
  const limitTok = headers.get("x-ratelimit-limit-tokens");

  if (remainingReq !== null || remainingTok !== null) {
    console.log(
      `[Groq] Requests: ${remainingReq}/${limitReq} left | ` +
      `Tokens: ${remainingTok}/${limitTok} left (this minute)`
    );
  }
};

// ── PUBLIC: generate a smart title, or null on any failure ─────
// `documents` is always an array now — [{ fileName, extractedText }].
// Single-document sessions get the existing spread-sample behavior.
// Multi-document sessions get one small sample PER document, so the
// title reflects the whole uploaded set instead of just one file.
export const generateSmartTitle = async (documents) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const docs = Array.isArray(documents) ? documents.filter(Boolean) : [];
  if (docs.length === 0) return null;

  const isMulti = docs.length > 1;
  const sample = isMulti
    ? buildMultiDocSample(docs)
    : buildSpreadSample(docs[0].extractedText);

  if (!sample) return null;

  const systemPrompt = isMulti
    ? "You will be given short excerpts from MULTIPLE documents uploaded together in one session, each labelled " +
      "[Document N: filename]. First decide: do these documents share a common topic/theme, or are they clearly " +
      "unrelated / cover different subjects? " +
      "If they SHARE a common theme, return ONLY a single unified 3-6 word title describing that shared theme. " +
      "If they are UNRELATED or cover clearly different subjects, return ONLY a short combined title in the exact " +
      "format 'TopicA + TopicB + TopicC' — a 1-3 word topic label per document, joined by ' + ', covering at most " +
      "the 3 most distinct topics (if there are more than 3 documents, cover the 3 most distinct and end with ' + more'). " +
      "Never use a person's name, form field, header, or metadata as any topic label. " +
      "No quotes, no trailing punctuation, no preamble — just the title text."
    : "You will be given three excerpts (Opening, Middle, Ending) from one document. " +
      "Return ONLY a 3-6 word title describing the SUBJECT MATTER / TOPIC of the document. " +
      "Never use a person's name, form field, header, or metadata as the title — unless the " +
      "document IS a resume/CV, in which case describe it as a resume/CV for that field or role. " +
      "No quotes, no trailing punctuation, no preamble — just the title text.";

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(GROQ_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.2,
        max_tokens: 16,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: sample },
        ],
      }),
    });

    clearTimeout(timer);
    logRateLimitHeaders(response.headers);

    if (!response.ok) {
      console.warn(`[Groq] Non-OK response: ${response.status}`);
      return null;
    }

    const data = await response.json();
    const title = data.choices?.[0]?.message?.content?.trim();

    if (!title || title.length < 3) return null;

    // Safety net: strip any stray quotes/punctuation the model
    // might still add despite instructions.
    const cleaned = title.replace(/^["'“”]+|["'“”.]+$/g, "").trim();

    // Hard length cap — matters most for the "A + B + C" unrelated-
    // docs format, which has no natural upper bound from the word
    // count instruction alone. Sidebar titles already truncate via
    // CSS, but this keeps the stored title itself sane too.
    const MAX_TITLE_CHARS = 60;
    return cleaned.length > MAX_TITLE_CHARS
      ? cleaned.slice(0, MAX_TITLE_CHARS).trim() + "…"
      : cleaned;
  } catch (err) {
    clearTimeout(timer);
    // Timeout, network failure, abort — always fail silently.
    console.warn(`[Groq] Title generation skipped: ${err.message}`);
    return null;
  }
};