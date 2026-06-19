// ============================================================
// aiController.js
//
// WHAT CHANGED IN THIS VERSION:
//
// 1. FIXED INCOMPLETE RESPONSE BUG (the 2-3 line cutoff issue)
//    The old token formula was: totalChars × ratio. This
//    doesn't account for STRUCTURAL OVERHEAD — each document
//    needs a full section (Overview, Concepts, Definitions,
//    Examples, Takeaways) regardless of how short its content
//    is. With multiple documents, the per-doc budget shrank
//    too much, causing Gemini to run out of tokens completing
//    the final section.
//    FIX: Added a PER-DOCUMENT STRUCTURAL FLOOR — each document
//    now reserves a guaranteed minimum token budget for its
//    own section, on top of the content-proportional amount.
//
// 2. HONEST GAP REPORTING
//    extractText.js now flags image-heavy/scanned documents
//    with a [SYSTEM NOTE]. This controller passes that signal
//    through to Gemini explicitly so the AI mentions gaps
//    instead of inventing content to compensate — this is
//    what "not biased" means: the AI is honest about what it
//    could not read from the document.
//
// 3. API KEY FROM HEADER (Phase 1 — unchanged from before)
//    Each user's own Gemini key is read from the request
//    header, falls back to .env for local development.
// ============================================================

import knowledgeStore from "../utils/knowledgeStore.js";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_CHARS_PER_DOC = 25000;

// ── TOKEN BUDGET CALCULATOR (FIXED) ──────────────────────────
//
// OLD FORMULA: totalChars × ratio
//   Problem: didn't scale with number of documents. 2 docs
//   sharing one small budget meant neither got enough room
//   to complete its full structured section.
//
// NEW FORMULA: (totalChars × ratio) + (docCount × structuralFloor)
//   Each document gets a guaranteed minimum "structural floor"
//   of tokens reserved for its headers/sections, PLUS its
//   proportional share based on actual content size.
//   This ensures a 2-document upload doesn't starve either
//   document of the tokens needed to finish its section.

const MODE_RATIO = { summary: 0.08, notes: 0.14, explain: 0.18 };
const MIN_TOKENS = { summary: 400, notes: 600, explain: 800 };

// Per-document structural floor — tokens reserved per document
// regardless of content size, to guarantee its section completes.
const STRUCTURAL_FLOOR = { summary: 250, notes: 450, explain: 600 };

const MAX_TOKENS = 7800; // safely under Gemini 2.5 Flash's 8192 ceiling

const calculateTokenBudget = (documents, mode) => {
  const totalChars = documents.reduce(
    (sum, doc) => sum + (doc.extractedText?.length || 0),
    0,
  );
  const docCount = documents.length;

  const ratio = MODE_RATIO[mode] || 0.1;
  const floor = STRUCTURAL_FLOOR[mode] || 300;
  const min = MIN_TOKENS[mode] || 400;

  // Content-proportional amount + guaranteed per-document floor
  const contentBudget = Math.round(totalChars * ratio);
  const structuralBudget = docCount * floor;

  const total = contentBudget + structuralBudget;

  return Math.min(Math.max(total, min), MAX_TOKENS);
};

// ── CONTENT PROFILE BUILDER ──────────────────────────────────
// Tells Gemini what it's working with BEFORE generating.
// Now also passes through the [SYSTEM NOTE] gap-flags from
// extractText.js so Gemini reports honestly on image-heavy docs.

const buildContentProfile = (documents, mode) => {
  const totalChars = documents.reduce(
    (sum, doc) => sum + (doc.extractedText?.length || 0),
    0,
  );
  const docCount = documents.length;

  const docProfiles = documents
    .map((doc, i) => {
      const chars = doc.extractedText?.length || 0;
      const ext = doc.fileName.split(".").pop().toLowerCase();
      const sizeLabel =
        chars < 2000
          ? "very short (1-2 pages)"
          : chars < 6000
            ? "short (3-5 pages)"
            : chars < 15000
              ? "medium (6-15 pages)"
              : chars < 30000
                ? "long (15-30 pages)"
                : "very long (30+ pages)";

      // Detect if this doc was flagged as image-heavy by extractText.js
      const hasGapWarning = doc.extractedText?.includes("[SYSTEM NOTE:");

      return `  Document ${i + 1}: "${doc.fileName}" — ${ext.toUpperCase()}, ${sizeLabel}, ${chars} characters${hasGapWarning ? " ⚠️ CONTAINS LOW-TEXT-DENSITY WARNING — see content for details" : ""}`;
    })
    .join("\n");

  const depthInstruction =
    mode === "summary"
      ? "Produce a summary proportional to each document's size. Short docs get concise overviews, long docs get thorough coverage. Do not pad or truncate."
      : mode === "notes"
        ? "Produce revision notes proportional to content. Brief docs need focused notes, dense docs need comprehensive notes with all concepts covered."
        : "Produce explanations proportional to depth. Brief docs need clear focused teaching, dense docs need thorough concept-by-concept coverage.";

  return `CONTENT PROFILE:
You are processing ${docCount} document${docCount > 1 ? "s" : ""} with ${totalChars} total characters.

${docProfiles}

DEPTH INSTRUCTION: ${depthInstruction}

HONESTY RULE: If any document content includes a "[SYSTEM NOTE:" marker, that means the original file had very little extractable text — it likely contains scanned pages, charts, diagrams, or images that could not be read. When this occurs, explicitly mention in your response that this document may contain visual content (charts/images/diagrams) not captured in this analysis, rather than inventing details to fill the gap. Never fabricate content to compensate for missing text.

IMPORTANT: Adjust response depth to match actual content. Never end before covering all major content in every document, and never stop mid-section — always complete the structure for every document before finishing.`;
};

// ── GEMINI API CALL ──────────────────────────────────────────

const callGemini = async (
  systemInstruction,
  userContent,
  apiKey,
  maxTokens,
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
      contents: [{ role: "user", parts: [{ text: userContent }] }],
      generationConfig: {
        temperature: 0.2,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: maxTokens,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error("Gemini API error:", data);
    throw new Error(data.error?.message || "Gemini request failed");
  }

  // Check finish reason — helps debug truncation issues
  const finishReason = data.candidates?.[0]?.finishReason;
  if (finishReason === "MAX_TOKENS") {
    console.warn(
      "⚠️ Gemini response was cut off due to MAX_TOKENS limit. Consider raising token budget for this request.",
    );
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

// ── KNOWLEDGE BUILDER ────────────────────────────────────────

const buildKnowledge = (documents) => {
  return documents
    .map((doc, i) => {
      const text = doc.extractedText || "";
      let content;

      if (text.length <= MAX_CHARS_PER_DOC) {
        content = text;
      } else {
        const halfSize = Math.floor(MAX_CHARS_PER_DOC / 2);

        let headSlice = text.slice(0, halfSize);
        const lastBreakHead = headSlice.lastIndexOf("\n");
        if (lastBreakHead > halfSize * 0.7)
          headSlice = headSlice.slice(0, lastBreakHead);

        let tailSlice = text.slice(text.length - halfSize);
        const firstBreakTail = tailSlice.indexOf("\n");
        if (firstBreakTail !== -1 && firstBreakTail < halfSize * 0.3) {
          tailSlice = tailSlice.slice(firstBreakTail + 1);
        }

        content = `${headSlice}\n\n[... middle section omitted for token efficiency ...]\n\n${tailSlice}`;
      }

      return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
DOCUMENT ${i + 1}: ${doc.fileName}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${content.trim()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;
    })
    .join("\n\n");
};

// ── SYSTEM INSTRUCTIONS ──────────────────────────────────────

const SUMMARY_SYSTEM = `You are an expert document intelligence agent producing clear, accurate executive summaries. Every sentence carries real information extracted directly from the source.

[ZERO HALLUCINATION CONTRACT]
- Extract only what is explicitly present in the text. Do not infer or invent.
- Start directly with the first markdown header. No preamble or meta-commentary.
- DO NOT use markdown tables. Use bullet points and headers only.
- If a document contains a "[SYSTEM NOTE:" marker, mention that this document may include visual content (charts/images) not captured in the text analysis. Never invent details to compensate.

[STYLE]
- Plain professional English. Explain technical terms briefly in parentheses.
- Active voice only. No filler words.
- Every bullet must contain a real specific fact.
- Response length matches content: short doc = concise summary, long doc = thorough summary.
- ALWAYS complete every section for every document before finishing your response. Never stop mid-section.

[MULTI-DOC RULE]
Each document gets its own ## section. Place a horizontal rule (---) between each document's section so the reader can instantly see where one document ends and the next begins — this is the ONLY transition marker allowed. Never write sentences like "Moving to the next document" or "File 1 complete" — the --- and the new ## header are sufficient. End with ## Combined Key Insights.

[FORMAT]
# Executive Summary

## [Exact Document Filename]
[2-3 sentence overview of scope and purpose]

### Core Themes & Findings
- **[Theme]**: [Specific finding with real details from the text]
  - [Supporting fact from the document]

### Critical Takeaways
- **[Key fact #1]**
- **[Key fact #2]**

---

## [Next Document Filename]
[Same structure repeats]

[After all documents, add:]
---

## Combined Key Insights
- [Cross-document connection or contrast]
- [Unified takeaway]`;

const NOTES_SYSTEM = `You are an expert academic tutor creating complete, structured revision notes. Dense with real information — definitions, concepts, examples — built for exam revision.

[ZERO HALLUCINATION CONTRACT]
- Capture every major topic, concept, and keyword from the text. Do not invent.
- Start directly with the first markdown header. No introductory sentences.
- If a document contains a "[SYSTEM NOTE:" marker, add a brief note in that document's section mentioning it may include visual content (charts/images) not captured here. Never invent details to compensate.

[CRITICAL FORMATTING RULES]
- NEVER use markdown tables. Use bullet points and headers only throughout.
- Use **bold** for every key term, concept name, definition, and important fact.
- Use bullet points and sub-bullets — zero long paragraphs.
- Place critical rules, formulas, or key definitions inside > blockquotes.
- Use - [ ] checkbox format only for step-by-step processes.
- Every section must be independently complete.
- Response length matches content: short doc = focused notes, long doc = comprehensive. Do not pad or truncate.
- ALWAYS complete every section for every document before finishing. Never stop mid-section — if running low on space, prioritize finishing the current document's structure over adding extra detail elsewhere.

[MULTI-DOC RULE]
Each document gets its own full ## 📄 [filename] section. Place a horizontal rule (---) between each document's section so the reader instantly sees where one document ends and the next begins — this is the ONLY transition marker allowed. Never write sentences like "Moving to the next document" or "File 1 complete." End with ## ⚡ Quick Revision combining all.

[FORMAT]
# Study Notes

## 📄 [Exact Document Filename]

### Overview
- [What this document covers — 2-3 specific bullets]

### Key Concepts
- **[Concept]**: [What it is and how it works]

### Definitions
- **[Term]**: [Precise definition]

> [Critical formula, rule, or definition]

### Important Examples & Case Studies
- **[Example name]**: [What it is, what happened, outcome]

### Key Takeaways
- [Most important point #1]
- [Most important point #2]

---

## 📄 [Next Document Filename]
[Same structure repeats]

[After all documents, add:]
---

## ⚡ Quick Revision — All Documents
- **[Term/Concept]**: [One-line fact or definition]`;

const EXPLAIN_SYSTEM = `You are an expert professor explaining documents to a smart student who is new to the topic. Your job is to teach — not summarize. The student should genuinely understand every concept after reading.

[ZERO HALLUCINATION CONTRACT]
- Use only facts and concepts explicitly in the text. Do not invent.
- Start immediately with the first heading. No introductory sentences or filler.
- If a document contains a "[SYSTEM NOTE:" marker, mention in that document's section that it may include visual content (charts/images) not captured here. Never invent details to compensate.

[TEACHING RULES]
- For every concept: WHAT it is + WHY it matters + HOW it works — all three, always.
- Use real examples, case studies, and data directly from the documents.
- For technical topics: explain the intuition and logic, not just a definition.
- Professional direct tone. Never write filler openers.
- Response length matches content depth. ALWAYS complete every section for every document — never cut off mid-section. If running low on space, prioritize finishing the current document's structure over adding extra polish elsewhere.

[MULTI-DOC RULE]
Each document gets a full ## 📘 [topic] section. Place a horizontal rule (---) between each document's section so the reader instantly sees where one document ends and the next begins — this is the ONLY transition marker allowed. Never write sentences like "Moving to the next document" or "File 1 complete." End with ## How These Connect.

[FORMAT]
# Deep Explanation

## 📘 [Topic — use actual subject, not just filename]

### What This Is About
[1-2 sentences: what area this covers and what problem it addresses]

### Core Concepts

**[Concept Name]**
- **What it is**: [Plain English definition]
- **Why it matters**: [Practical significance]
- **How it works**: [Mechanism or logic step by step]
- **Example from document**: [Real example or data point]

[Repeat for every major concept]

### How It All Works Together
[How the concepts connect and function as a system]

### Why This Matters
[Real-world significance and applications]

### Key Things to Remember
- [Takeaway #1]
- [Takeaway #2]
- [Takeaway #3]
- [Takeaway #4]
- [Takeaway #5]

[If multiple documents:]

---

## 📘 [Next Document Topic]
[Same structure repeats]

---

## 🔗 How These Documents Connect
[How topics relate, contrast, or build on each other — specific]`;

// ── MAIN CONTROLLER ──────────────────────────────────────────

export const generateAIResponse = async (req, res) => {
  try {
    const { type, selectedDocumentIds } = req.body;

    // API KEY RESOLUTION — user's header key takes priority over .env
    const userKey = req.headers["x-gemini-key"];
    const serverKey = process.env.GEMINI_API_KEY;
    const apiKey = userKey && userKey.startsWith("AIza") ? userKey : serverKey;

    if (!apiKey) {
      return res.status(401).json({
        success: false,
        message:
          "No Gemini API key found. Please add your API key in the app settings.",
      });
    }

    if (!type || !["summary", "notes", "explain"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be: summary, notes, or explain.",
      });
    }

    const allDocuments = knowledgeStore.getAllDocuments();
    let docsToUse = allDocuments;

    if (Array.isArray(selectedDocumentIds) && selectedDocumentIds.length > 0) {
      const filtered = allDocuments.filter((d) =>
        selectedDocumentIds.includes(d.id),
      );
      if (filtered.length > 0) docsToUse = filtered;
    }

    if (!docsToUse || docsToUse.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No documents found. Please upload and process files first.",
      });
    }

    // Token budget now accounts for per-document structural overhead
    const tokenBudget = calculateTokenBudget(docsToUse, type);
    const contentProfile = buildContentProfile(docsToUse, type);
    const knowledge = buildKnowledge(docsToUse);

    let systemInstruction;
    if (type === "summary") systemInstruction = SUMMARY_SYSTEM;
    else if (type === "notes") systemInstruction = NOTES_SYSTEM;
    else systemInstruction = EXPLAIN_SYSTEM;

    const userContent = `${contentProfile}

Analyze the following documents strictly according to your system instructions. Cover ALL content in every document. Do not end the response before finishing all documents.

${knowledge}`;

    const result = await callGemini(
      systemInstruction,
      userContent,
      apiKey,
      tokenBudget,
    );

    if (!result || result.trim().length < 30) {
      return res.status(500).json({
        success: false,
        message: "Gemini returned an empty response. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      result,
      documentsProcessed: docsToUse.length,
      documentNames: docsToUse.map((d) => d.fileName),
      tokenBudget,
    });
  } catch (error) {
    console.error("AI Controller Error:", error.message);

    const isRateLimit =
      error.message?.toLowerCase().includes("quota") ||
      error.message?.toLowerCase().includes("rate") ||
      error.message?.toLowerCase().includes("limit");

    const isInvalidKey =
      error.message?.toLowerCase().includes("api key") ||
      error.message?.toLowerCase().includes("invalid") ||
      error.message?.toLowerCase().includes("unauthorized");

    return res.status(500).json({
      success: false,
      message: isRateLimit
        ? "Gemini rate limit reached. Please wait 1-2 minutes and try again."
        : isInvalidKey
          ? "Invalid API key. Please check your Gemini API key in settings."
          : error.message || "AI generation failed.",
    });
  }
};
