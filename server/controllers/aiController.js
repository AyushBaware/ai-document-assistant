import knowledgeStore from "../utils/knowledgeStore.js";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_CHARS_PER_DOC = 25000;

// ======================================================
// TOKEN BUDGET CALCULATOR
//
// Instead of a fixed maxOutputTokens for every request,
// we calculate it based on how much content actually exists.
//
// Rule: ~1 output token per 8 input chars is a good baseline.
// Summary needs less output than Explain.
// We clamp between a minimum (so tiny docs still get
// a proper response) and a maximum (free tier safety).
//
// Gemini 2.5 Flash free tier: ~8192 max output tokens.
// We stay under that ceiling while scaling proportionally.
//
// Example:
//   1 small PDF (2000 chars) → summary: ~512 tokens
//   1 medium PDF (15000 chars) → summary: ~1500 tokens
//   2 large PPTXs (40000 chars total) → notes: ~4000 tokens
// ======================================================

const MODE_RATIO = {
  summary: 0.08, // Summary is compressed — fewer output tokens needed
  notes: 0.14, // Notes are dense — more output tokens needed
  explain: 0.18, // Explain is thorough — most output tokens needed
};

const MIN_TOKENS = {
  summary: 400,
  notes: 600,
  explain: 800,
};

const MAX_TOKENS = 7500; // Stay safely under Gemini's 8192 ceiling

const calculateTokenBudget = (documents, mode) => {
  const totalChars = documents.reduce(
    (sum, doc) => sum + (doc.extractedText?.length || 0),
    0,
  );

  const ratio = MODE_RATIO[mode] || 0.1;
  const calculated = Math.round(totalChars * ratio);
  const min = MIN_TOKENS[mode] || 400;

  return Math.min(Math.max(calculated, min), MAX_TOKENS);
};

// ======================================================
// CONTENT PROFILE BUILDER
// Tells Gemini exactly what it's working with before
// it starts generating — so it calibrates depth naturally.
//
// This is what Claude does internally: it "reads" the
// document structure before deciding how much to write.
// We replicate that by giving Gemini an explicit content
// profile as part of the user message.
// ======================================================

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

      return `  Document ${i + 1}: "${doc.fileName}" — ${ext.toUpperCase()} file, ${sizeLabel}, ${chars} characters extracted`;
    })
    .join("\n");

  const depthInstruction =
    mode === "summary"
      ? "Produce a summary proportional to each document's size. Short documents get concise overviews. Long documents get thorough coverage. Do not pad short documents or truncate long ones."
      : mode === "notes"
        ? "Produce revision notes proportional to each document's content. A 2-page doc needs focused notes. A 20-page doc needs comprehensive notes with all concepts covered."
        : "Produce explanations proportional to each document's depth. Brief documents need clear focused teaching. Dense documents need thorough concept-by-concept coverage.";

  return `CONTENT PROFILE:
You are processing ${docCount} document${docCount > 1 ? "s" : ""} with ${totalChars} total characters of content.

${docProfiles}

DEPTH INSTRUCTION: ${depthInstruction}

IMPORTANT: Adjust your response depth to match the actual content. If a document is short, a concise complete response is correct. If a document is long and detailed, a comprehensive response is required. Never end a response before covering all major content in every document.`;
};

// ======================================================
// GEMINI API CALL
// maxOutputTokens is now dynamic per request.
// ======================================================

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
      contents: [
        {
          role: "user",
          parts: [{ text: userContent }],
        },
      ],
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

  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

// ======================================================
// KNOWLEDGE BUILDER
// Labels each document with clear separators.
// Smart truncation cuts at line breaks, not mid-word.
// ======================================================

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
        if (lastBreakHead > halfSize * 0.7) {
          headSlice = headSlice.slice(0, lastBreakHead);
        }

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

// ======================================================
// SUMMARY SYSTEM INSTRUCTION
// ======================================================

const SUMMARY_SYSTEM = `You are an expert document intelligence agent producing clear, accurate executive summaries. Every sentence carries real information extracted directly from the source.

[ZERO HALLUCINATION CONTRACT]
- Extract only what is explicitly present in the provided text. Do not infer or invent.
- Start directly with the first markdown header. No preamble or meta-commentary.
- DO NOT use markdown tables. Use bullet points and headers only.

[STYLE RULES]
- Plain professional English. Explain technical terms briefly in parentheses if needed.
- Active voice only. No filler words.
- Every bullet must contain a real specific fact — not a vague description of a fact.
- Response length matches content volume: short document = concise summary, long document = thorough summary.

[MULTI-DOCUMENT RULE]
Multiple documents each get their own ## section. End with ## Combined Key Insights.

[FORMAT]
# Executive Summary

## [Exact Document Filename]
[2-3 sentence overview of scope and purpose]

### Core Themes & Findings
- **[Theme]**: [Specific finding with real details from the text]
  - [Supporting fact directly from the document]

### Critical Takeaways
- **[Key fact or outcome #1]**
- **[Key fact or outcome #2]**

[Repeat per document if multiple, then:]

## Combined Key Insights
- [Cross-document connection or contrast]
- [Unified takeaway]`;

// ======================================================
// NOTES SYSTEM INSTRUCTION
// NO MARKDOWN TABLES — they cause Gemini to dump all
// content into one cell and burn the entire token budget.
// ======================================================

const NOTES_SYSTEM = `You are an expert academic tutor creating complete, structured revision notes. Your notes are dense with real information — definitions, concepts, examples — built for exam revision.

[ZERO HALLUCINATION CONTRACT]
- Capture every major topic, concept, and keyword from the text. Do not invent.
- Start directly with the first markdown header. No introductory sentences.

[CRITICAL FORMATTING RULES]
- NEVER use markdown tables. Use bullet points and headers only throughout.
- Use **bold** for every key term, concept name, definition, and important fact.
- Use bullet points and sub-bullets — zero long paragraphs.
- Place critical rules, formulas, or key definitions inside > blockquotes.
- Use - [ ] checkbox format only for step-by-step processes when relevant.
- Every section must be independently complete.
- Response length matches content: short document = focused notes, long document = comprehensive notes. Do not pad or truncate.

[MULTI-DOCUMENT RULE]
Each document gets its own full ## 📄 [filename] section. End with ## ⚡ Quick Revision combining all documents.

[FORMAT]
# Study Notes

## 📄 [Exact Document Filename]

### Overview
- [What this document covers — 2-3 specific bullets]

### Key Concepts
- **[Concept]**: [What it is and how it works]
- **[Concept]**: [Definition and significance]

### Definitions
- **[Term]**: [Precise definition]

> [Critical formula, rule, or definition that must not be forgotten]

### Important Examples & Case Studies
- **[Example name]**: [What it is, what happened, what the outcome was]

### Key Takeaways
- [Most important point #1]
- [Most important point #2]
- [Most important point #3]

[Repeat full structure for each document if multiple, then:]

## ⚡ Quick Revision — All Documents
- **[Term/Concept]**: [One-line fact or definition]`;

// ======================================================
// EXPLAIN SYSTEM INSTRUCTION
// ======================================================

const EXPLAIN_SYSTEM = `You are an expert professor explaining documents to a smart student who is new to the topic. Your job is to teach — not summarize. The student should genuinely understand every concept after reading.

[ZERO HALLUCINATION CONTRACT]
- Use only facts and concepts explicitly in the provided text. Do not invent.
- Start immediately with the first heading. No introductory sentences or filler.

[TEACHING RULES]
- For every concept: WHAT it is + WHY it matters + HOW it works — all three, always.
- Use real examples, case studies, and data directly from the documents.
- For technical topics: explain the intuition and logic behind it, not just a definition.
- For case studies: what happened, why, the outcome, and the lesson.
- Professional direct tone. Never write "Great!" or filler openers.
- Response length matches content depth: brief documents get focused teaching, dense documents get thorough concept-by-concept coverage. Never cut off before finishing all documents.

[MULTI-DOCUMENT RULE]
Each document gets a full ## 📘 [topic] section. End with ## How These Connect.

[FORMAT]
# Deep Explanation

## 📘 [Topic — use actual subject, not just filename]

### What This Is About
[1-2 sentences: what area this covers and what it addresses]

### Core Concepts

**[Concept Name]**
- **What it is**: [Plain English definition]
- **Why it matters**: [Practical significance]
- **How it works**: [Mechanism or logic — step by step if technical]
- **Example from document**: [Real example or data point from the text]

[Repeat for every major concept]

### How It All Works Together
[How the concepts connect and function as a system]

### Why This Matters
[Real-world significance and applications]

### Key Things to Remember
- [Takeaway #1 — specific and memorable]
- [Takeaway #2]
- [Takeaway #3]
- [Takeaway #4]
- [Takeaway #5]

[If multiple documents:]

## 🔗 How These Documents Connect
[How topics relate, contrast, complement, or build on each other — be specific]`;

// ======================================================
// MAIN CONTROLLER
// ======================================================

export const generateAIResponse = async (req, res) => {
  try {
    const { type } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        message: "Gemini API key is not configured.",
      });
    }

    if (!type || !["summary", "notes", "explain"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be: summary, notes, or explain.",
      });
    }

    const allDocuments = knowledgeStore.getAllDocuments();
    const { selectedDocumentIds } = req.body || {};

    let docsToUse = allDocuments;
    if (
      selectedDocumentIds &&
      Array.isArray(selectedDocumentIds) &&
      selectedDocumentIds.length > 0
    ) {
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

    // Calculate dynamic token budget based on content size + mode
    const tokenBudget = calculateTokenBudget(docsToUse, type);

    // Build content profile — tells Gemini what it's working with
    const contentProfile = buildContentProfile(docsToUse, type);

    // Build document knowledge context
    const knowledge = buildKnowledge(docsToUse);

    // Select system instruction
    let systemInstruction;
    if (type === "summary") systemInstruction = SUMMARY_SYSTEM;
    else if (type === "notes") systemInstruction = NOTES_SYSTEM;
    else systemInstruction = EXPLAIN_SYSTEM;

    // User content: profile first, then documents
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
      tokenBudget, // Useful for debugging
    });
  } catch (error) {
    console.error("AI Controller Error:", error.message);

    const isRateLimit =
      error.message?.toLowerCase().includes("quota") ||
      error.message?.toLowerCase().includes("rate") ||
      error.message?.toLowerCase().includes("limit");

    return res.status(500).json({
      success: false,
      message: isRateLimit
        ? "Gemini rate limit reached. Please wait 1-2 minutes and try again."
        : error.message || "AI generation failed.",
    });
  }
};
