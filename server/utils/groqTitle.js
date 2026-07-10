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
export const generateSmartTitle = async (extractedText) => {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return null;

  const spreadSample = buildSpreadSample(extractedText);
  if (!spreadSample) return null;

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
          {
            role: "system",
            content:
              "You will be given three excerpts (Opening, Middle, Ending) from one document. " +
              "Return ONLY a 3-6 word title describing the SUBJECT MATTER / TOPIC of the document. " +
              "Never use a person's name, form field, header, or metadata as the title — unless the " +
              "document IS a resume/CV, in which case describe it as a resume/CV for that field or role. " +
              "No quotes, no trailing punctuation, no preamble — just the title text.",
          },
          { role: "user", content: spreadSample },
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
    return title.replace(/^["'“”]+|["'“”.]+$/g, "").trim();
  } catch (err) {
    clearTimeout(timer);
    // Timeout, network failure, abort — always fail silently.
    console.warn(`[Groq] Title generation skipped: ${err.message}`);
    return null;
  }
};