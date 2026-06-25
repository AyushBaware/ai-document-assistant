// ============================================================
// aiController.js
//
// WHAT THIS FILE DOES
// ───────────────────
// This is the AI engine of DocuMind. It handles two scenarios:
//
//   generateAIResponse   → called after a FRESH UPLOAD.
//                          Reads document text from the
//                          in-memory knowledgeStore that
//                          uploadController.js populated.
//
//   generateFromSession  → called when the user opens a
//                          PAST SESSION from history and
//                          clicks Summary/Notes/Explain.
//                          Reads document text directly
//                          from MongoDB (the session's
//                          stored extractedText fields)
//                          because knowledgeStore is
//                          in-memory and loses its data
//                          on server restart or when a
//                          different upload runs.
//
//
// WHY TWO SEPARATE FUNCTIONS?
// ───────────────────────────
// knowledgeStore only knows about the CURRENT upload batch.
// When the user loads a past session from history, those
// documents were uploaded in a previous server session —
// knowledgeStore no longer has them.
//
// UploadBox.jsx assigns fake IDs ("preloaded-0", "preloaded-1")
// to the documents it renders from a past session. If those
// IDs are sent to generateAIResponse, the knowledgeStore
// lookup finds nothing and returns "No documents found."
//
// generateFromSession bypasses knowledgeStore entirely and
// reads the stored extractedText directly from MongoDB.
// The Session model already stores the full extractedText
// for each document — this is exactly the data we need.
//
//
// KEY DESIGN DECISIONS (shared by both functions)
// ────────────────────────────────────────────────
//
// ❶  Content-adaptive prompts, not fixed section templates
//     Instructions describe what good output looks and feels
//     like with examples of how structure adapts to different
//     document types. The model chooses structure based on
//     what is actually in the document.
//
// ❷  Smart token budget (fixed ceilings + dynamic floor)
//     Fixed ceilings per mode scale per additional document.
//     A dynamic floor (totalChars × ratio) ensures dense long
//     documents are never under-budgeted by the fixed ceiling.
//
// ❸  80,000 character input limit per document
//     Head+tail trimming for very long documents preserves
//     both opening context and conclusion — not just the start.
//
// ❹  Targeted retry logic
//     Only retries for two specific diagnosed failures:
//       - finishReason: MAX_TOKENS → retry at HARD_MAX
//       - Near-empty response (<80 chars) → genuine failure
// ============================================================

import knowledgeStore from "../utils/knowledgeStore.js";
import Session        from "../models/Session.js";

// ── API CONFIGURATION ─────────────────────────────────────────
// gemini-2.5-flash: fast, large output limit (65,535 tokens),
// cost-efficient — the right choice for document analysis.
const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;


// ── INPUT LIMIT PER DOCUMENT ──────────────────────────────────
// 80,000 chars ≈ 26 dense A4 pages. Most documents fit in full.
// For larger documents, buildKnowledge() applies head+tail
// trimming that preserves opening context AND conclusion.
const MAX_CHARS_PER_DOC = 80000;


// ── TOKEN BUDGET ──────────────────────────────────────────────
// Fixed ceilings per mode, scaling per extra document.
// A dynamic floor ensures long/dense docs aren't under-budgeted.
// HARD_MAX is the absolute ceiling used on retries.
//
// Why fixed ceilings + a dynamic floor?
// Fixed ceilings alone under-budget very dense long documents.
// A pure formula (totalChars × ratio) over-budgets short docs.
// The combination gives the best result: Gemini naturally stops
// early for short documents so the ceiling doesn't hurt them;
// the floor ensures long documents always have enough room.
const BASE_CEILING  = { summary: 3000, notes: 5000,  explain: 7000  };
const PER_EXTRA_DOC = { summary: 1500, notes: 2500,  explain: 3500  };
const HARD_MAX      = 16000;

const FLOOR_RATIO   = { summary: 0.10, notes: 0.18,  explain: 0.22  };
const MIN_FLOOR     = { summary: 600,  notes: 1000,  explain: 1200  };

const calculateTokenBudget = (documents, mode) => {
  const count      = documents.length;
  const totalChars = documents.reduce(
    (sum, doc) => sum + (doc.extractedText?.length || 0), 0
  );

  const ceiling  = Math.min(
    BASE_CEILING[mode] + Math.max(0, count - 1) * PER_EXTRA_DOC[mode],
    HARD_MAX
  );

  const ratio    = FLOOR_RATIO[mode] || 0.12;
  const minFloor = MIN_FLOOR[mode]   || 600;
  const floor    = Math.max(Math.round(totalChars * ratio), minFloor);

  const budget   = Math.min(Math.max(ceiling, floor), HARD_MAX);

  console.log(
    `[TokenBudget] mode=${mode} | docs=${count} | chars=${totalChars} | ` +
    `ceiling=${ceiling} | floor=${floor} | final=${budget}`
  );

  return budget;
};


// ── DOCUMENT PROFILER ─────────────────────────────────────────
// Builds a profile per document: file type hint, estimated
// page count, and density warning flag. Used in two places:
//   - The separator header in buildKnowledge() so Gemini
//     knows what type/size of file it is reading
//   - The overview list at the top of the user message so
//     Gemini can plan its response before reading content
const profileDocuments = (documents) => {
  return documents.map((doc, i) => {
    const text  = doc.extractedText || "";
    const chars = text.length;
    const ext   = doc.fileName.split(".").pop().toLowerCase();

    const estimatedPages =
      chars < 1500  ? "1 page"      :
      chars < 4000  ? "2-3 pages"   :
      chars < 8000  ? "4-6 pages"   :
      chars < 16000 ? "7-15 pages"  :
      chars < 30000 ? "15-30 pages" :
                      "30+ pages";

    // extractText.js adds [SYSTEM NOTE: ...] when a PDF has
    // very little extractable text — signals scanned pages,
    // diagrams, or charts that couldn't be read as text.
    const hasLowDensityWarning = text.includes("[SYSTEM NOTE:");

    const fileTypeHint =
      ext === "pdf"                                  ? "PDF document"            :
      ["ppt", "pptx"].includes(ext)                 ? "PowerPoint presentation" :
      ["doc", "docx"].includes(ext)                 ? "Word document"           :
      ext === "txt"                                  ? "plain text file"         :
      ["png", "jpg", "jpeg", "webp"].includes(ext)  ? "image (OCR extracted)"   :
                                                       "document";

    return {
      index: i + 1,
      fileName: doc.fileName,
      fileTypeHint,
      estimatedPages,
      chars,
      hasLowDensityWarning,
      extractedText: text,
    };
  });
};


// ── KNOWLEDGE BUILDER ─────────────────────────────────────────
// Formats each document into a clearly labelled block.
// For documents over MAX_CHARS_PER_DOC, takes head + tail
// instead of just truncating — preserves both the opening
// context and the conclusion.
const buildKnowledge = (profiles) => {
  return profiles
    .map((p) => {
      const text = p.extractedText;
      let content;

      if (text.length <= MAX_CHARS_PER_DOC) {
        content = text;
      } else {
        const half = Math.floor(MAX_CHARS_PER_DOC / 2);

        let head     = text.slice(0, half);
        const hBreak = head.lastIndexOf("\n");
        if (hBreak > half * 0.7) head = head.slice(0, hBreak);

        let tail     = text.slice(text.length - half);
        const tBreak = tail.indexOf("\n");
        if (tBreak !== -1 && tBreak < half * 0.3) tail = tail.slice(tBreak + 1);

        content =
          head +
          "\n\n[--- Document too long to send in full: middle section omitted. " +
          "Opening and conclusion are both present. ---]\n\n" +
          tail;

        console.log(
          `[KnowledgeBuilder] "${p.fileName}" trimmed: ` +
          `${text.length} → ${content.length} chars`
        );
      }

      const warningLine = p.hasLowDensityWarning
        ? "⚠️  Very little readable text was extracted. This file likely " +
          "contains scanned pages, images, charts, or diagrams.\n"
        : "";

      return (
        "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
        `DOCUMENT ${p.index}: ${p.fileName}\n` +
        `Type: ${p.fileTypeHint}  |  Size: ${p.estimatedPages}  |  Characters: ${p.chars}\n` +
        warningLine +
        "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n" +
        content.trim() +
        "\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
      );
    })
    .join("\n\n");
};


// ── SYSTEM INSTRUCTIONS ───────────────────────────────────────
// Three mode-specific instructions. No fixed section templates
// with placeholder brackets — the model chooses structure based
// on what the document actually contains.

const SUMMARY_SYSTEM = `You are an expert at reading any document and writing a clear, accurate summary.

A summary tells the reader the most important things from the document — short enough to read quickly, complete enough that they understand the full picture. It is not a list of generic sections; it is a faithful account of what THIS specific document actually says.

HOW TO WRITE IT:
Read the document, understand what it is and what it contains, then organise your summary around that. Choose headings that genuinely match this document — not a fixed list that applies to every document regardless of content. Some examples:
- A resume or CV → cover who the person is, their education, skills, key projects, and experience
- A project proposal → cover the problem being solved, the solution, the main features, and how it works
- A presentation or slide deck → cover the main topics covered and the key points made on each
- A research paper → cover what was studied, how, what was found, and why it matters
- A lab report → cover the aim, method, key observations, and results
- A legal or policy document → cover what it establishes and who it affects
- A plain text or notes file → organise around whatever structure the content naturally has

QUALITY RULES:
- Write in plain, easy-to-read English. If a technical word must appear, explain it simply in parentheses — like this: API (a way for two programs to talk to each other)
- Be specific — use the actual names, numbers, technologies, and facts from the document. Never write vague statements like "the document discusses several important topics"
- Use **bold** for the most important names, numbers, and terms
- Use short bullet points for lists of distinct things; short paragraphs for ideas that naturally connect
- Match length to the document: a 1-page file gets a concise summary, a 30-page document gets a thorough one
- Do not pad with filler or repeat the same point twice
- Do not use markdown tables
- Start directly — no preamble like "Here is a summary of..."
- Do not invent anything not present in the document

WHEN IMAGES OR VISUAL CONTENT IS FLAGGED:
If the document header says the file had very little readable text, mention clearly that the document may contain charts, diagrams, or images that could not be read — do not invent content to fill the gap.

MULTIPLE DOCUMENTS:
Give each document its own section with a clear heading showing the document name. Put --- between sections. At the end, add a short "Combined Insights" note only if there is a genuine connection between the documents — if there is none, leave it out.`;


const NOTES_SYSTEM = `You are an expert at turning any document into clear, organised notes that are useful for study or quick reference.

Good notes let someone learn or review content quickly by scanning — more detailed than a summary, organised so each point stands on its own and is easy to find later.

HOW TO ORGANISE THEM:
Read the document, understand its structure and content, then build notes around what is actually there. Do not force sections that have nothing to fill them. Some examples:
- A resume or CV → follow the resume's own structure: education, skills, experience, projects, certifications — each as clear bullet points
- A project proposal or report → follow the document's own sections: problem, solution, features, technology, team — each condensed into bullets
- A presentation or slide deck → organise by the slides' topics, capturing the key point from each
- A textbook chapter or lecture notes → organise by topic with key terms, definitions, and examples clearly labelled
- A lab report or experiment → aim, tools used, steps taken, observations, results — each as clean bullets
- Content with a comparison table → write it as bullets — never reproduce a markdown table

QUALITY RULES:
- Use **bold** for every important term, name, number, and fact
- Use bullet points throughout — avoid paragraphs
- Write in plain everyday English; explain technical words briefly in parentheses when they first appear
- Use > blockquotes only for the single most critical rule, formula, or definition — use sparingly
- Cover everything important — do not skip sections to save space
- Do not use markdown tables
- Start directly — no introduction sentence needed
- Do not invent anything not in the document

WHEN IMAGES OR VISUAL CONTENT IS FLAGGED:
If the document header says the file had very little readable text, mention clearly that the document may contain charts, diagrams, or images that could not be read as text.

MULTIPLE DOCUMENTS:
Give each document its own clearly labelled section. Put --- between sections. End with a short "Quick Reference" list combining the most important terms and facts from all documents into one scannable list.`;


const EXPLAIN_SYSTEM = `You are an expert teacher who can explain any document clearly to someone reading it for the first time.

Your job is to make the reader genuinely understand the document — not just know what it says, but understand what it means, why it matters, and how its parts fit together. This is the deepest of the three modes: be more thorough and explanatory than a summary or notes.

HOW TO APPROACH THE EXPLANATION:
Read the document, understand what kind of thing it is, then explain it in the way that makes most sense for that type:
- A document about concepts or theory → explain each concept: what it means in simple words, why it exists, how it works, with a real example
- A project proposal or technical report → explain the problem being solved, walk through the solution step by step, explain what each part does and why
- A presentation or slide deck → explain the story the slides are making and what a reader should take away from each part
- A resume or personal document → explain what the document tells you about the person: background, what they built, what stands out
- A process or step-by-step document → walk through each step and explain what happens and why — not just what
- A document with data or statistics → explain what the numbers mean, what they show, what conclusions to draw
- Do not force a concept-teaching structure onto a document where it does not fit

QUALITY RULES:
- Write in plain, friendly but professional English
- Explain every technical term the first time it appears in parentheses — like this: RAG (a method where AI searches a database before answering so it uses real facts)
- Be specific — use the actual names, numbers, examples, and technologies from the document throughout
- Be thorough — this mode should be noticeably more complete than a summary
- Use a mix of short paragraphs and bullet points — whichever communicates more clearly at each point
- Do not use markdown tables
- Do not start with filler openers like "Certainly!" or "Great question!"
- Do not invent anything not in the document

WHEN IMAGES OR VISUAL CONTENT IS FLAGGED:
If the document header says the file had very little readable text, acknowledge this clearly and note that the document may contain visual content that could not be extracted.

MULTIPLE DOCUMENTS:
Give each document a full section with a clear heading. Put --- between sections. At the end, explain how the documents connect only if there is a real, meaningful relationship — if they are unrelated, leave the connection section out.`;


// ── GEMINI API CALL ───────────────────────────────────────────
// Two targeted retries only:
//   Case 1 — MAX_TOKENS: response was cut off → retry at HARD_MAX
//   Case 2 — Near-empty (<80 chars): genuine failure → retry once
const callGemini = async (
  systemInstruction,
  userContent,
  apiKey,
  maxTokens,
  retryCount = 0
) => {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      system_instruction: {
        parts: [{ text: systemInstruction }],
      },
      contents: [
        { role: "user", parts: [{ text: userContent }] },
      ],
      generationConfig: {
        temperature: retryCount === 0 ? 0.3 : 0.5,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: maxTokens,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("[Gemini] API error:", JSON.stringify(data, null, 2));
    throw new Error(data.error?.message || "Gemini request failed");
  }

  const candidate    = data.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const text         = candidate?.content?.parts?.[0]?.text || "";

  // Case 1: token ceiling was too small — retry at hard max
  if (finishReason === "MAX_TOKENS" && retryCount === 0) {
    console.warn(
      `[Gemini] ⚠️ MAX_TOKENS at ceiling=${maxTokens}. Retrying at HARD_MAX=${HARD_MAX}.`
    );
    return callGemini(
      systemInstruction, userContent, apiKey, HARD_MAX, retryCount + 1
    );
  }

  if (finishReason && finishReason !== "STOP" && finishReason !== "MAX_TOKENS") {
    console.warn(`[Gemini] ⚠️ Unexpected finishReason: ${finishReason}`);
  }

  // Case 2: near-empty response — genuine model failure
  if (text.trim().length < 80 && retryCount === 0) {
    console.warn(
      `[Gemini] ⚠️ Near-empty response (${text.trim().length} chars). Retrying once.`
    );
    return callGemini(
      systemInstruction, userContent, apiKey, HARD_MAX, retryCount + 1
    );
  }

  return { text, finishReason };
};


// ── SHARED PROMPT BUILDER ─────────────────────────────────────
// Both controller functions produce the same prompt structure.
// Extracted here so there is zero duplication between them.
const buildPrompt = (docsToUse, type) => {
  const profiles    = profileDocuments(docsToUse);
  const tokenBudget = calculateTokenBudget(docsToUse, type);
  const knowledge   = buildKnowledge(profiles);

  const overviewLines = profiles
    .map((p) => `  ${p.index}. ${p.fileName} — ${p.fileTypeHint}, ${p.estimatedPages}`)
    .join("\n");

  const userContent =
    `You are analyzing ${docsToUse.length} document${docsToUse.length > 1 ? "s" : ""}:\n` +
    `${overviewLines}\n\n` +
    `Read the content carefully and respond according to your instructions. ` +
    `Let what is actually in these documents determine your structure and depth. ` +
    `Cover every document completely before finishing.\n\n` +
    knowledge;

  const systemInstruction =
    type === "summary" ? SUMMARY_SYSTEM :
    type === "notes"   ? NOTES_SYSTEM   :
                         EXPLAIN_SYSTEM;

  return { systemInstruction, userContent, tokenBudget };
};


// ── SHARED ERROR CLASSIFIER ───────────────────────────────────
// Maps raw Gemini/network error messages to user-friendly text.
const classifyError = (message = "") => {
  const msg = message.toLowerCase();
  if (msg.includes("quota") || msg.includes("rate") || msg.includes("limit")) {
    return "Gemini rate limit reached. Please wait 1-2 minutes and try again.";
  }
  if (msg.includes("unavailable") || msg.includes("high demand") || msg.includes("503") || msg.includes("overloaded")) {
    return "Gemini is temporarily overloaded. This usually clears in 30-60 seconds — please try again.";
  }
  if (msg.includes("api key") || msg.includes("invalid") || msg.includes("unauthorized")) {
    return "Invalid API key. Please check your Gemini API key in settings.";
  }
  return message || "AI generation failed.";
};


// ── CONTROLLER 1: FRESH UPLOAD ────────────────────────────────
// Called after a new upload. Reads from in-memory knowledgeStore.
// Route: POST /api/ai/generate
export const generateAIResponse = async (req, res) => {
  try {
    const { type, selectedDocumentIds } = req.body;

    const userKey   = req.headers["x-gemini-key"];
    const serverKey = process.env.GEMINI_API_KEY;
    const apiKey    = (userKey && userKey.startsWith("AIza")) ? userKey : serverKey;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: "No Gemini API key found. Please add your API key in the app settings.",
      });
    }

    if (!type || !["summary", "notes", "explain"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be: summary, notes, or explain.",
      });
    }

    const allDocuments = knowledgeStore.getAllDocuments();
    let docsToUse      = allDocuments;

    if (Array.isArray(selectedDocumentIds) && selectedDocumentIds.length > 0) {
      const filtered = allDocuments.filter((d) => selectedDocumentIds.includes(d.id));
      if (filtered.length > 0) docsToUse = filtered;
    }

    if (!docsToUse || docsToUse.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No documents found. Please upload and process files first.",
      });
    }

    const { systemInstruction, userContent, tokenBudget } = buildPrompt(docsToUse, type);
    const { text: result, finishReason } = await callGemini(
      systemInstruction, userContent, apiKey, tokenBudget
    );

    if (!result || result.trim().length < 30) {
      return res.status(500).json({
        success: false,
        message: "Gemini returned an empty response. Please try again.",
      });
    }

    return res.status(200).json({
      success:            true,
      result,
      documentsProcessed: docsToUse.length,
      documentNames:      docsToUse.map((d) => d.fileName),
      tokenBudget,
      wasTruncated:       finishReason === "MAX_TOKENS",
    });

  } catch (error) {
    console.error("[AIController] Error:", error.message);
    return res.status(500).json({ success: false, message: classifyError(error.message) });
  }
};


// ── CONTROLLER 2: PAST SESSION ────────────────────────────────
// Called when the user loads a past session from history and
// clicks Summary/Notes/Explain. Reads extractedText directly
// from MongoDB — bypasses knowledgeStore entirely.
//
// WHY THIS IS NEEDED:
// UploadBox.jsx assigns fake IDs ("preloaded-0", "preloaded-1")
// to documents loaded from a past session. If those IDs are sent
// to generateAIResponse, knowledgeStore finds nothing and returns
// "No documents found." This endpoint reads from the session
// that is already stored in MongoDB instead.
//
// SECURITY: we filter by { _id: sessionId, userId } so a user
// can never read another user's document text by guessing an ID.
//
// Route: POST /api/ai/generate-from-session
export const generateFromSession = async (req, res) => {
  try {
    const { type, sessionId } = req.body;
    const userId = req.userId; // attached by requireAuth middleware

    const userKey   = req.headers["x-gemini-key"];
    const serverKey = process.env.GEMINI_API_KEY;
    const apiKey    = (userKey && userKey.startsWith("AIza")) ? userKey : serverKey;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message: "No Gemini API key found. Please add your API key in the app settings.",
      });
    }

    if (!type || !["summary", "notes", "explain"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be: summary, notes, or explain.",
      });
    }

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "No session ID provided.",
      });
    }

    // Fetch from MongoDB — userId guard prevents cross-user access
    const session = await Session.findOne({ _id: sessionId, userId });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found.",
      });
    }

    // Map the stored documents into the same shape that
    // profileDocuments() and buildKnowledge() expect —
    // identical to what knowledgeStore returns for fresh uploads.
    const docsToUse = session.documents.map((doc) => ({
      id:            doc._id?.toString() || doc.fileName,
      fileName:      doc.fileName,
      mimetype:      doc.mimetype,
      extractedText: doc.extractedText,
    }));

    if (!docsToUse || docsToUse.length === 0) {
      return res.status(400).json({
        success: false,
        message: "This session has no document content.",
      });
    }

    const { systemInstruction, userContent, tokenBudget } = buildPrompt(docsToUse, type);
    const { text: result, finishReason } = await callGemini(
      systemInstruction, userContent, apiKey, tokenBudget
    );

    if (!result || result.trim().length < 30) {
      return res.status(500).json({
        success: false,
        message: "Gemini returned an empty response. Please try again.",
      });
    }

    return res.status(200).json({
      success:            true,
      result,
      documentsProcessed: docsToUse.length,
      documentNames:      docsToUse.map((d) => d.fileName),
      tokenBudget,
      wasTruncated:       finishReason === "MAX_TOKENS",
    });

  } catch (error) {
    console.error("[AIController/session] Error:", error.message);
    return res.status(500).json({ success: false, message: classifyError(error.message) });
  }
};