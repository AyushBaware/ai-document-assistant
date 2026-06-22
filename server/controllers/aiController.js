// ============================================================
// aiController.js
//
// ROOT CAUSE FIX — "thin response" bug explained properly:
//
// The previous version had ONE rigid template per mode
// (Summary/Notes/Explain), built for educational documents
// (lecture notes, textbooks, case studies). When given a
// SHORT REFERENCE document — a resume, certificate, single
// page notice — the template demands sections like "Core
// Concepts", "Real-World Analogy", "5 Key Things to Remember"
// that genuinely don't apply. Gemini has nothing to put there,
// so it outputs headers with no content, repeatedly, even
// across retries — because the PROBLEM ISN'T TOKEN BUDGET,
// it's that the template doesn't fit the document type.
//
// THE FIX: Document Type Detection.
// Before building the prompt, we classify each document as
// either:
//   - "reference"   → resumes, certificates, short notices,
//                      forms. Uses a LIGHTER, more flexible
//                      template that adapts to whatever
//                      content actually exists.
//   - "educational" → lecture notes, textbooks, case studies,
//                      longer technical documents. Uses the
//                      original structured teaching template.
//
// Classification heuristic: documents under 4000 characters
// AND containing resume/CV-like keyword density (objective,
// education, skills, experience, certifications) are treated
// as reference documents. This is a pragmatic heuristic, not
// ML classification — accurate enough for this use case
// without adding model complexity.
// ============================================================

import knowledgeStore from "../utils/knowledgeStore.js";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const MAX_CHARS_PER_DOC = 25000;

// ── DOCUMENT TYPE DETECTION ──────────────────────────────────
// Pragmatic heuristic — not perfect, but solves the real
// failure mode: short reference documents being forced through
// a heavy academic template.

const REFERENCE_DOC_KEYWORDS = [
  "objective",
  "education",
  "skills",
  "experience",
  "certifications",
  "curriculum vitae",
  "resume",
  "cv",
  "references available",
  "professional summary",
  "work experience",
  "contact information",
];

const SHORT_DOC_THRESHOLD = 4000; // chars

const classifyDocument = (text) => {
  if (!text) return "educational";

  const lower = text.toLowerCase();
  const isShort = text.length < SHORT_DOC_THRESHOLD;

  const keywordMatches = REFERENCE_DOC_KEYWORDS.filter((kw) =>
    lower.includes(kw),
  ).length;

  // Short + at least 2 reference-document keywords = treat as reference
  if (isShort && keywordMatches >= 2) {
    return "reference";
  }

  return "educational";
};

// ── TOKEN BUDGET CALCULATOR ──────────────────────────────────
// Unchanged formula — token budget was never the actual bug,
// confirmed via diagnosis. Kept for documents that genuinely
// need more room.

const MODE_RATIO = { summary: 0.08, notes: 0.14, explain: 0.18 };
const MIN_TOKENS = { summary: 400, notes: 600, explain: 800 };
const STRUCTURAL_FLOOR = { summary: 250, notes: 450, explain: 600 };
const MAX_TOKENS = 7800;

const calculateTokenBudget = (documents, mode) => {
  const totalChars = documents.reduce(
    (sum, doc) => sum + (doc.extractedText?.length || 0),
    0,
  );
  const docCount = documents.length;

  const ratio = MODE_RATIO[mode] || 0.1;
  const floor = STRUCTURAL_FLOOR[mode] || 300;
  const min = MIN_TOKENS[mode] || 400;

  const contentBudget = Math.round(totalChars * ratio);
  const structuralBudget = docCount * floor;
  const total = contentBudget + structuralBudget;

  return Math.min(Math.max(total, min), MAX_TOKENS);
};

// ── CONTENT PROFILE BUILDER ──────────────────────────────────
// Now also tells Gemini the detected document type per file,
// so it knows which structural expectations are appropriate.

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
      const docType = classifyDocument(doc.extractedText);
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

      const hasGapWarning = doc.extractedText?.includes("[SYSTEM NOTE:");

      return `  Document ${i + 1}: "${doc.fileName}" — ${ext.toUpperCase()}, ${sizeLabel}, ${chars} characters, TYPE: ${docType.toUpperCase()}${hasGapWarning ? " ⚠️ CONTAINS LOW-TEXT-DENSITY WARNING — see content for details" : ""}`;
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

DOCUMENT TYPE RULE: For documents marked TYPE: REFERENCE (resumes, certificates, forms, short notices), DO NOT force academic teaching structures like "Core Concepts" or "Real-World Analogy" if they don't naturally apply. Instead, adapt your response to describe what the document actually contains — sections, key facts, structure — using whatever headers genuinely fit the content. For documents marked TYPE: EDUCATIONAL, follow your standard structured format completely.

HONESTY RULE: If any document content includes a "[SYSTEM NOTE:" marker, that means the original file had very little extractable text — it likely contains scanned pages, charts, diagrams, or images that could not be read. When this occurs, explicitly mention in your response that this document may contain visual content (charts/images/diagrams) not captured in this analysis, rather than inventing details to fill the gap. Never fabricate content to compensate for missing text.

IMPORTANT: Adjust response depth to match actual content. Never end before covering all major content in every document, and never stop mid-section — always complete the structure for every document before finishing. If a section genuinely has nothing to say for a REFERENCE document, omit that section entirely rather than leaving it empty.`;
};

// ── GEMINI API CALL ──────────────────────────────────────────
// Thin-response retry logic preserved — still useful as a
// safety net for educational documents, now combined with
// document-type-aware prompting which fixes the root cause
// for reference documents.

const MIN_ACCEPTABLE_RESPONSE_RATIO = 0.03;
const MIN_ACCEPTABLE_RESPONSE_CHARS = 200; // lowered slightly — reference docs can legitimately produce shorter, complete responses

const callGemini = async (
  systemInstruction,
  userContent,
  apiKey,
  maxTokens,
  retryCount = 0,
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
        temperature: retryCount === 0 ? 0.2 : 0.4,
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

  const candidate = data.candidates?.[0];
  const finishReason = candidate?.finishReason;
  const text = candidate?.content?.parts?.[0]?.text || "";

  if (finishReason && finishReason !== "STOP") {
    console.warn(
      `⚠️ Gemini finishReason: ${finishReason} (not a normal completion)`,
    );
  }

  const inputLength = userContent.length;
  const isTooShort =
    text.trim().length < MIN_ACCEPTABLE_RESPONSE_CHARS ||
    text.trim().length < inputLength * MIN_ACCEPTABLE_RESPONSE_RATIO;

  if (isTooShort && retryCount === 0) {
    console.warn(
      `⚠️ Thin response detected (${text.trim().length} chars for ${inputLength} chars of input). Retrying once with adjusted parameters.`,
    );
    const strengthenedInstruction =
      systemInstruction +
      `\n\n[CRITICAL REMINDER]: Your previous attempt produced only headers with no actual content. If this is a REFERENCE document (resume, certificate, short notice), adapt your structure to fit the actual content — describe what's genuinely there rather than forcing irrelevant sections. If this is an EDUCATIONAL document, fill in every section with real, specific information extracted from the text.`;

    return callGemini(
      strengthenedInstruction,
      userContent,
      apiKey,
      maxTokens,
      retryCount + 1,
    );
  }

  return text;
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
// Each now includes a document-type-adaptive escape hatch —
// see [DOCUMENT TYPE ADAPTATION] block at the bottom of each.

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
Each document gets its own ## section. Place a horizontal rule (---) between each document's section so the reader can instantly see where one document ends and the next begins — this is the ONLY transition marker allowed. End with ## Combined Key Insights.

[DOCUMENT TYPE ADAPTATION]
For REFERENCE documents (resumes, certificates, forms): summarize what the document actually establishes — who/what it's about, key qualifications or facts, structure. Skip sections that don't apply rather than leaving them empty.
For EDUCATIONAL documents: use the full format below.

[FORMAT — for educational documents]
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
- If a document contains a "[SYSTEM NOTE:" marker, add a brief note in that document's section mentioning it may include visual content (charts/images) not captured here.

[CRITICAL FORMATTING RULES]
- NEVER use markdown tables. Use bullet points and headers only throughout.
- Use **bold** for every key term, concept name, definition, and important fact.
- Use bullet points and sub-bullets — zero long paragraphs.
- Place critical rules, formulas, or key definitions inside > blockquotes.
- Every section must be independently complete.
- Response length matches content: short doc = focused notes, long doc = comprehensive.

[MULTI-DOC RULE]
Each document gets its own full ## 📄 [filename] section. Place a horizontal rule (---) between each document's section. End with ## ⚡ Quick Revision combining all.

[DOCUMENT TYPE ADAPTATION]
For REFERENCE documents (resumes, certificates, forms): create notes that organize the document's actual content — key facts, qualifications, structure. Skip "Definitions" or "Examples" sections if nothing genuinely fits there.
For EDUCATIONAL documents: use the full format below.

[FORMAT — for educational documents]
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
- If a document contains a "[SYSTEM NOTE:" marker, mention in that document's section that it may include visual content (charts/images) not captured here.

[TEACHING RULES]
- For every concept: WHAT it is + WHY it matters + HOW it works — all three, always.
- Use real examples, case studies, and data directly from the documents.
- Professional direct tone. Never write filler openers.
- Response length matches content depth. ALWAYS complete every section before finishing.

[MULTI-DOC RULE]
Each document gets a full ## 📘 [topic] section. Place a horizontal rule (---) between each document's section. End with ## How These Connect.

[DOCUMENT TYPE ADAPTATION]
For REFERENCE documents (resumes, certificates, forms): explain what the document represents, what it tells the reader, and its purpose — not as a "concept to teach" but as an artifact to understand. Use a simpler structure: What This Document Is, What It Shows, Key Highlights. Do NOT force "Core Concepts" with "Real-World Analogy" structure onto a resume — that produces empty, awkward sections.
For EDUCATIONAL documents: use the full format below.

[FORMAT — for educational documents]
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
