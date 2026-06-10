// ======================================================
// AI CONTROLLER
// Architecture: Per-document awareness + smart synthesis
//
// RAG CONCEPT: Instead of dumping all text blindly,
// we label each document separately so Gemini knows
// WHICH file each concept came from. Then we ask it
// to synthesize across documents — exactly how Claude
// and NotebookLM handle multi-document intelligence.
//
// Token optimization: We cap per-document text at 20k
// chars (~5k tokens). For a 2-doc upload that's ~10k
// tokens of input — well within Gemini 2.5 Flash free
// tier limits, with room for a 3k token response.
// ======================================================

import knowledgeStore from "../utils/knowledgeStore.js";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// Max chars per document sent to Gemini
// 15000 chars ≈ 3750 tokens — balanced for multi-document speed and token efficiency
const MAX_CHARS_PER_DOC = 15000;

// ======================================================
// GEMINI REQUEST
// ======================================================

const callGemini = async (prompt, apiKey, maxOutputTokens = 2200) => {
  const response = await fetch(GEMINI_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }],
        },
      ],
      generationConfig: {
        temperature: 0.15,
        topK: 40,
        topP: 0.90,
        maxOutputTokens,
        candidateCount: 1,
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

const buildPerDocumentPrompt = (type, doc, index, docCount) => {
  const excerpt = buildKnowledge([doc]);
  const header = `Document ${index + 1}/${docCount}: ${doc.fileName}`;

  switch (type) {
    case "summary":
      return `You are an expert professional summarizer. Produce a clear, accurate, and easy-to-read summary that any professional can understand on first read (not childish, not overly technical).

${header}

CLARITY RULES:
- Use short, well-formed sentences (one idea per sentence).
- Avoid unnecessary jargon; if a technical term is used, immediately provide a 1-line plain-language definition in parentheses.
- Lead with a 1-2 sentence Plain-Language Summary that anyone can grasp at a glance.
- After the plain summary, provide structured sections with bullets for easy scanning.
- If the document is long, include a short "Document Sections Covered" list. If you cannot cover something due to length, append a line: "TRUNCATED: [list missing sections]".

OUTPUT FORMAT:

## ${doc.fileName}

**Plain-Language Summary (1-2 sentences):**
[A concise summary anyone can understand]

**Key Points (bullets):**
- [3-7 bullets with the most important facts or findings, each 1-2 short sentences]

**Readable Explanation:**
[2-4 short paragraphs that explain the main ideas in simple professional language]

**Practical Implications & Takeaway:**
- [What this means; 2-3 short bullets]

**Document Sections Covered:**
- [List major sections you included]

DOCUMENT:
${excerpt}`;

    case "notes":
      return `You are a world-class academic tutor creating study notes that are clear, concise, and immediately useful for revision. Use short sentences and hierarchical bullets so readers can learn on first pass.

${header}

CLARITY RULES:
- Prefer short sentences and clear definitions.
- Bold key terms and provide a 1-line plain-language explanation for any technical term.
- Organize with headings and nested bullets; each bullet should be 1-2 sentences maximum.
- End with a short Revision Summary for quick recall.

OUTPUT FORMAT:

## Study Notes: ${doc.fileName}

### Overview (1-2 sentences)

### Core Concepts & Definitions
- **Term** — one-line definition (plain language)

### Key Facts & Processes
- Bullet points with short, actionable descriptions and examples

### Important Examples / Case Studies
- Short, concrete examples pulled from the document

### Quick Revision Summary (3-6 bullets)
- Key facts, numbers, or actions to remember

DOCUMENT:
${excerpt}`;

    case "explain":
      return `You are an exceptionally clear educator whose explanations are professional, precise, and easy to understand on first read. Use short sentences, plain-language summaries, and analogies where helpful.

${header}

CLARITY RULES:
- Begin with a 1-2 sentence Plain-Language Summary.
- For each major idea: state the idea, provide a one-line plain-language explanation, then a short example or analogy.
- Keep paragraphs short (1-3 sentences). Use bullet lists for steps or processes.
- If any technical term appears, provide a one-line definition immediately.
- Include a "Document Sections Covered" list and, if anything could not be covered due to length, append: "TRUNCATED: [sections missing]".

OUTPUT FORMAT:

## Understanding ${doc.fileName}

**Plain-Language Summary (1-2 sentences):**

**Major Ideas & Clear Explanations:**
- Idea 1 — one-line plain explanation. Example/analogy: ...
- Idea 2 — one-line plain explanation. Example/analogy: ...

**How It Works (step-by-step if applicable):**
- Short numbered or bulleted steps with brief explanations

**Concrete Examples & Practical Significance:**
- Short examples drawn from the document and what they imply

**Summary & Key Takeaways (3-5 bullets):**
- Important final points to remember

DOCUMENT:
${excerpt}`;

    default:
      return `Create a comprehensive, professional summary of this document:

${header}

DOCUMENT:
${excerpt}`;
  }
};

const buildSynthesisPrompt = (type, perDocResults, documents) => {
  const docCount = documents.length;
  const fileNames = documents.map((doc) => doc.fileName).join("\n");
  const perDocSections = perDocResults
    .map(
      (result, index) =>
        `---\nDOCUMENT ${index + 1}: ${result.fileName}\n\n${result.text.trim()}`
    )
    .join("\n\n");

  const instructions = `You are synthesizing comprehensive analysis from ${docCount} documents. Your task: Create a unified, professional response that presents each document fully, shows genuine connections, and delivers insights worthy of Claude or Perplexity.`;

  switch (type) {
    case "summary":
      return `${instructions}

CLARITY RULES: Produce plain-language, short-sentence writing. Lead with a very short Per-Document completeness check, then the document sections, then a readable synthesis. Avoid dense paragraphs; use bullets where helpful.

PER-DOCUMENT CONTENT (as received):
${perDocSections}

OUTPUT FORMAT:

## COMPLETENESS CHECK
- For each document, write: Document N (${documents.map(d=>d.fileName).join(', ')}): COMPLETE or TRUNCATED (list missing sections if TRUNCATED)

---

# Document-Level Summaries

${documents
        .map(
          (doc, index) =>
            `## ${doc.fileName}\n\n[Write a clear, plain-language summary of this document based on the per-document content above. Start with a 1-2 sentence plain summary, then 3-6 key bullets.]
`
        )
        .join("\n\n")}

---

## 🔗 Readable Synthesis: Key Connections & Unified Insights

[Write a professional, easy-to-understand synthesis that:
- Identifies shared themes across documents
- Explains how ideas connect or conflict (short bullets)
- Highlights unique contributions of each document
- States practical implications and recommended next steps (if any)
- Keep language plain and sentences short]
`;

    case "notes":
      return `${instructions}

CLARITY RULES: Produce study notes in plain professional language. Start with a per-document completeness check. Use bolded terms and 1-line definitions. Keep bullets short and scannable.

PER-DOCUMENT CONTENT (as received):
${perDocSections}

OUTPUT FORMAT:

## COMPLETENESS CHECK
- For each document: COMPLETE or TRUNCATED (list missing sections if TRUNCATED)

---

# Complete Study Notes

${documents
        .map(
          (doc, index) =>
            `## 📄 ${doc.fileName}\n\n[Expand into clear notes: Overview (1-2 sentences), Core Concepts (bold + 1-line def), Key Facts, Examples, and Takeaways in short bullets.]`
        )
        .join("\n\n---\n\n")}

---

## ⚡ Master Quick Revision — All Documents

[A combined bullet list of essential terms (bold), formulas, numbers, and short definitions across all documents.]
`;

    case "explain":
      return `${instructions}

CLARITY RULES: Produce a plain-language explanatory synthesis. Begin with per-document completeness checks. For each document include a 1-2 sentence plain summary, then clear explanation items: definition, why it matters, short example/analogy. Finish with a unified, easy-to-read framework.

PER-DOCUMENT CONTENT (as received):
${perDocSections}

OUTPUT FORMAT:

## COMPLETENESS CHECK
- For each document: COMPLETE or TRUNCATED (list missing sections)

---

# Comprehensive Explanation

${documents
        .map(
          (doc, index) =>
            `## Understanding ${doc.fileName}\n\n[Plain-Language Summary (1-2 sentences)]\n\n- Major Idea A — short plain explanation + brief example/analogy\n- Major Idea B — short plain explanation + brief example/analogy\n\n(Include simple numbered steps if explaining a process.)`
        )
        .join("\n\n---\n\n")}

---

## 🔗 Unified Framework: How It All Connects

[Summarize connections, patterns, and practical implications in short bullets.]
`;

    default:
      return `${instructions}

PER-DOCUMENT CONTENT:
${perDocSections}`;
  }
};

// ======================================================
// KNOWLEDGE BUILDER
// Builds a labeled, structured context block per document.
// Gemini performs significantly better when it knows
// which content belongs to which file — this is the
// key difference vs. blind text concatenation.
// ======================================================

const buildKnowledge = (documents) => {
  return documents
    .map((doc, i) => {
      // Smart truncation: take from start and end
      // so we capture intro context AND conclusions
      const text = doc.extractedText || "";
      let content;

      if (text.length <= MAX_CHARS_PER_DOC) {
        content = text;
      } else {
        const half = Math.floor(MAX_CHARS_PER_DOC / 2);
        content =
          text.slice(0, half) +
          "\n\n[... middle section ...]\n\n" +
          text.slice(text.length - half);
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
// PROMPT BUILDER
// Each mode has a distinct "persona" and output contract.
// The FORMAT section is explicit — Gemini follows strict
// structure much better when you give it exact headers
// to fill, not just vague formatting instructions.
// ======================================================

const buildPrompt = (type, knowledge, documents) => {
  const docCount = documents.length;
  const multiDoc = docCount > 1;
  const fileNames = documents.map((doc) => doc.fileName);
  const fileTitleList = fileNames
    .map((name, index) => `${index + 1}. ${name}`)
    .join("\n");
  const documentSectionsExample = fileNames
    .map((name, index) => `## Document ${index + 1}: ${name}\n[summary]`)
    .join("\n\n");
  const documentNotesExample = fileNames
    .map(
      (name, index) =>
        `## 📄 Document ${index + 1}: ${name}\n\n### Overview\n### Key Concepts\n### Definitions\n### Important Examples / Case Studies\n### Key Takeaways`
    )
    .join("\n\n---\n\n");
  const documentExplainExample = fileNames
    .map(
      (name, index) =>
        `## 📘 Document ${index + 1}: ${name}\n\n### What This Is About\n### Core Concepts Explained\n### How It Works (Step by Step if applicable)\n### Real Examples from the Document\n### Why This Matters`
    )
    .join("\n\n---\n\n");
  const docContext = multiDoc
    ? `You have been given ${docCount} documents. Cover EACH document with its own section and explicitly note any overlap or connections between them.`
    : `You have been given 1 document. Cover it completely.`;

  switch (type) {

    // --------------------------------------------------
    // SUMMARY MODE
    // Goal: Executive-level overview, skimmable in 60s
    // --------------------------------------------------
    case "summary":
      return `You are an expert academic summarizer. Your summaries are known for being precise, complete, and easy to skim.

${docContext}

DOCUMENTS:
${fileTitleList}

RULES:
- Write in clean markdown.
- Be specific — include actual names, numbers, techniques, case studies from the documents.
- No filler phrases like "This document discusses..." — go straight to the substance.
- Each bullet must carry real information, not vague descriptions.
- If multiple documents, give each its own titled section using the actual file name.
- Do not repeat the same bullets across document sections.
- If multiple documents cover related topics, add a combined insights section with the connections.
- Total length: 400–600 words.

OUTPUT FORMAT (use exactly these headers):

${multiDoc
  ? `# Document Summaries\n\n${documentSectionsExample}\n\n---\n\n# Combined Key Insights\n[cross-document connections and unified takeaways]`
  : `# Overview\n[2-3 sentence high-level summary]\n\n# Key Points\n[bullet list of most important facts/concepts]\n\n# Important Details\n[specifics: names, numbers, techniques, examples]\n\n# Conclusion\n[what this document ultimately shows or argues]`}

DOCUMENTS:
${knowledge}`;

    // --------------------------------------------------
    // NOTES MODE
    // Goal: Revision-ready, exam-focused structured notes
    // --------------------------------------------------
    case "notes":
      return `You are a top academic tutor creating revision notes for a student preparing for exams. Your notes are structured, dense with information, and easy to revise from quickly.

${docContext}

RULES:
- Use **bold** for every key term, concept name, or important fact
- Use bullet points and sub-bullets — no long paragraphs
- Include actual definitions, formulas, examples, and case study details from the documents
- Every section should be independently useful — someone reading only that section should learn something complete
- If multiple documents, create separate note blocks per document, then a Quick Revision section combining all key terms
- Total length: comprehensive — don't cut content to save space

OUTPUT FORMAT:

${multiDoc
  ? `# Study Notes\n\n${documentNotesExample}\n\n---\n\n## ⚡ Quick Revision — All Documents\n[Combined bullet list of every important term and fact across all documents]`
  : `# Study Notes: [Topic]\n\n## Overview\n\n## Key Concepts\n\n## Definitions\n\n## Important Examples\n\n## Formulas / Techniques (if applicable)\n\n## Key Takeaways\n\n## ⚡ Quick Revision\n[Bullet list of every important point — fast-scan format]`}

DOCUMENTS:
${knowledge}`;

    // --------------------------------------------------
    // EXPLAIN MODE
    // Goal: Deep teaching, concept-by-concept clarity
    // --------------------------------------------------
    case "explain":
      return `You are an expert professor and mentor. You explain complex concepts in a way that makes them genuinely easy to understand — clear, logical, and engaging without being childish.

${docContext}

RULES:
- Explain what each concept IS, WHY it matters, and HOW it works
- Use real examples from the documents (case studies, code, data, scenarios)
- For technical topics: explain the logic/intuition behind techniques, not just definitions
- For case studies: explain what happened, why it worked or failed, and what to learn from it
- Professional tone — treat the reader as an intelligent person learning something new
- Never use filler like "Great question!" or "This is interesting" — just explain
- If multiple documents cover different topics, give each a clear section with its own explanation flow
- Total length: thorough — the goal is genuine understanding

OUTPUT FORMAT:

${multiDoc
  ? `# Deep Explanation\n\n${documentExplainExample}\n\n---\n\n## 🔗 Connections Between Documents\n[How the topics relate, contrast, or build on each other]`
  : `# Explanation: [Topic]\n\n## What This Is About\n\n## Core Concepts\n[Explain each major concept clearly]\n\n## How It Works\n[Step-by-step breakdown if technical, narrative flow if conceptual]\n\n## Real Examples\n[From the actual document — case studies, data, code, scenarios]\n\n## Why This Matters\n[Practical significance and applications]\n\n## Key Things to Remember\n[3-5 most important takeaways]`}

DOCUMENTS:
${knowledge}`;

    default:
      return `Summarize the following documents clearly and completely:\n\n${knowledge}`;
  }
};

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

    if (!["summary", "notes", "explain"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid type. Must be: summary, notes, or explain.",
      });
    }

    // Pull from knowledge store (populated during upload)
    const allDocuments = knowledgeStore.getAllDocuments();
    // Allow frontend to request analysis of a subset of documents
    const { selectedDocumentIds } = req.body || {};
    let docsToUse = allDocuments;
    if (
      selectedDocumentIds &&
      Array.isArray(selectedDocumentIds) &&
      selectedDocumentIds.length > 0
    ) {
      docsToUse = allDocuments.filter((d) => selectedDocumentIds.includes(d.id));
      if (!docsToUse || docsToUse.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No matching documents found for selectedDocumentIds.",
        });
      }
    }

    if (!allDocuments || allDocuments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No documents found. Please upload and process files first.",
      });
    }

    // Build structured knowledge context using selected docs (or all)
    const runDocuments = docsToUse;

    // Token budgets per mode — more generous for explain to ensure complete coverage
    const tokenBudgets = {
      summary: { single: 2200, perDoc: 1400, synthesis: 2200 },
      notes: { single: 2400, perDoc: 1600, synthesis: 2400 },
      explain: { single: 2600, perDoc: 1800, synthesis: 2800 }, // Explain needs more tokens for depth
    };

    const budget = tokenBudgets[type] || tokenBudgets.summary;

    if (runDocuments.length === 1) {
      const knowledge = buildKnowledge(runDocuments);
      const prompt = buildPrompt(type, knowledge, runDocuments);
      const result = await callGemini(prompt, apiKey, budget.single);

      if (!result || result.trim().length < 50) {
        return res.status(500).json({
          success: false,
          message: "Gemini returned an empty response. Try again.",
        });
      }

      return res.status(200).json({
        success: true,
        result,
        documentsProcessed: allDocuments.length,
        documentNames: allDocuments.map((d) => d.fileName),
      });
    }

    // For multiple documents, generate per-document results first,
    // then synthesize a final response from those document-specific outputs.
    const perDocResults = [];

    for (const [index, doc] of runDocuments.entries()) {
      const perDocPrompt = buildPerDocumentPrompt(type, doc, index, runDocuments.length);
      let perDocOutput = await callGemini(perDocPrompt, apiKey, budget.perDoc);

      // If model signals truncation, retry once with a larger token budget
      if (perDocOutput && perDocOutput.toUpperCase().includes("TRUNCATED")) {
        const retryTokens = Math.min(Math.floor(budget.perDoc * 1.5), 3200);
        perDocOutput = await callGemini(perDocPrompt, apiKey, retryTokens);
      }

      perDocResults.push({ fileName: doc.fileName, text: perDocOutput.trim() });
    }

    const synthesisPrompt = buildSynthesisPrompt(type, perDocResults, runDocuments);
    let result = await callGemini(synthesisPrompt, apiKey, budget.synthesis);

    // If synthesis indicates truncation or incompleteness, retry once with larger budget
    if (result && result.toUpperCase().includes("TRUNCATED")) {
      const synthRetry = Math.min(Math.floor(budget.synthesis * 1.25), 4000);
      result = await callGemini(synthesisPrompt, apiKey, synthRetry);
    }

    if (!result || result.trim().length < 50) {
      return res.status(500).json({
        success: false,
        message: "Gemini returned an empty response during synthesis. Try again.",
      });
    }

    return res.status(200).json({
      success: true,
      result,
      documentsProcessed: allDocuments.length,
      documentNames: allDocuments.map((d) => d.fileName),
    });

  } catch (error) {
    console.error("AI Controller Error:", error.message);

    // Friendly message for rate limit errors
    const isRateLimit =
      error.message?.toLowerCase().includes("quota") ||
      error.message?.toLowerCase().includes("rate") ||
      error.message?.toLowerCase().includes("limit");

    return res.status(500).json({
      success: false,
      message: isRateLimit
        ? "Gemini rate limit reached. Please wait 1–2 minutes and try again."
        : error.message || "AI generation failed.",
    });
  }
};