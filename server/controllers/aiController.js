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
      return `You are an expert professional summarizer. Produce a clear, accurate, and easy-to-read summary that covers the entire document. Use professional language, not conversational or childish phrasing.

${header}

RULES:
- Use short, well-formed sentences and avoid long, dense paragraphs.
- Avoid jargon; if a technical term is used, explain it briefly in parentheses.
- Cover the document's main thesis, key sections, important facts, and conclusion.
- Start with a 1-2 sentence overview, then use bullets and clear headings.
- Do not add unrelated content, filler, or internal reasoning.

OUTPUT FORMAT:

## ${doc.fileName}

**Overview:**
[A one- or two-sentence summary of the document's main idea]

**Key Points:**
- [3-6 short bullets with the most important findings or ideas]

**Important Details:**
- [Specific facts, examples, names, numbers, or methods]

**Bottom Line:**
- [A concise closing statement about the document's main message]

DOCUMENT:
${excerpt}`;

    case "notes":
      return `You are a top academic tutor creating study notes that are accurate, structured, and easy to review. Use professional, straightforward language and avoid informal or childish wording.

${header}

RULES:
- Use short sentences and clear language.
- Bold key terms and give a one-line explanation if a concept is technical.
- Organize notes into headings and short bullets.
- Cover the document's major concepts, details, examples, and conclusions.
- Keep each bullet concise and specific.
- Do not invent content that is not present in the document.

OUTPUT FORMAT:

## Study Notes: ${doc.fileName}

### Overview
[A brief statement of the main topic]

### Core Concepts
- **Term** — brief plain explanation

### Key Details
- Short bullets with important facts, processes, or examples

### Practical Examples
- Short examples from the document

### Key Takeaways
- 3-5 concise points to remember

### Quick Review
- 4-6 short bullets for revision

DOCUMENT:
${excerpt}`;

    case "explain":
      return `You are an expert educator who explains documents in a professional, clear, and easy-to-understand way. Use plain language, short sentences, and concrete examples. Avoid informal or childish phrasing.

${header}

RULES:
- Start with a 1-2 sentence overview of what the document is about.
- Explain each major idea clearly and directly.
- Use short bullets or short paragraphs, not long blocks of text.
- If a technical term is used, explain it briefly in parentheses.
- Include examples or scenarios from the document to make ideas concrete.
- Keep the tone professional and readable.
- Do not invent content that is not present in the document.

OUTPUT FORMAT:

## Understanding ${doc.fileName}

**Overview:**
[A one- or two-sentence description of the document's subject]

**Main Ideas:**
- Idea 1 — short explanation and brief example
- Idea 2 — short explanation and brief example

**How It Works:**
- Short bullets explaining processes or logic

**Examples & Practical Meaning:**
- Short examples from the document with what they show

**Why It Matters:**
- 2-3 short bullets explaining the document's importance

**Key Takeaways:**
- 3-5 concise points to remember

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

  const instructions = `You are synthesizing comprehensive analysis from ${docCount} documents. Your task: Create a unified, professional response that presents each document fully, shows genuine connections, and delivers insights worthy of Claude or Perplexity. If there are many documents, remain precise and cover each document's key ideas.`;

  switch (type) {
    case "summary":
      return `${instructions}

CLARITY RULES: Produce a professional, easy-to-read summary. Use short sentences, clear headings, and bullets. Cover each document fully and then show how the documents relate.

PER-DOCUMENT CONTENT:
${perDocSections}

OUTPUT FORMAT:

# Document Summaries

${documents
        .map(
          (doc, index) =>
            `## ${doc.fileName}\n\n[Write a concise, professional summary of this document based on the per-document content above. Start with a brief overview sentence, then 3-5 clear bullets. Be specific and avoid vague language.]
`
        )
        .join("\n\n")}

---

## Combined Insights

[Write a direct professional summary of shared themes, differences, and the most important insights across all documents. Keep the language precise and avoid filler. Do not add unrelated content.]
`;

    case "notes":
      return `${instructions}

CLARITY RULES: Produce accurate, review-ready notes in professional language. Use clear headings, bold key terms, and concise bullets. Cover each document fully and keep each section easy to scan.

PER-DOCUMENT CONTENT:
${perDocSections}

OUTPUT FORMAT:

# Complete Study Notes

${documents
        .map(
          (doc, index) =>
            `## 📄 ${doc.fileName}\n\n[Create clear, professional notes based on the document content above. Include Overview, Core Concepts, Key Details, Examples, and Key Takeaways in short bullets.]`
        )
        .join("\n\n---\n\n")}

---

## Master Quick Revision — All Documents

[Create a combined revision section with the most important terms, facts, and key points from all documents. Keep it concise and actionable.]
`;

    case "explain":
      return `${instructions}

CLARITY RULES: Produce a professional, easy-to-understand explanation. Write in short sentences, explain key ideas clearly, and use concrete examples. Cover each document fully and keep the tone direct.

PER-DOCUMENT CONTENT:
${perDocSections}

OUTPUT FORMAT:

# Comprehensive Explanation

${documents
        .map(
          (doc, index) =>
            `## Understanding ${doc.fileName}\n\n[Write a clear explanation of this document based on the content above. Include a brief overview, the main ideas, how it works, and a short example for each major point.]`
        )
        .join("\n\n---\n\n")}

---

## Unified Framework: How It All Connects

[Summarize the most important connections and insights across the documents in short, clear bullets. Keep the language formal and avoid filler.]
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
      const text = doc.extractedText || "";
      let content;

      if (text.length <= MAX_CHARS_PER_DOC) {
        content = text;
      } else {
        // Line-aware smart boundary truncation
        const halfSize = Math.floor(MAX_CHARS_PER_DOC / 2);
        
        let headSlice = text.slice(0, halfSize);
        const lastLineBreakHead = headSlice.lastIndexOf("\n");
        if (lastLineBreakHead > halfSize * 0.7) {
          headSlice = headSlice.slice(0, lastLineBreakHead);
        }

        let tailSlice = text.slice(text.length - halfSize);
        const firstLineBreakTail = tailSlice.indexOf("\n");
        if (firstLineBreakTail !== -1 && firstLineBreakTail < halfSize * 0.3) {
          tailSlice = tailSlice.slice(firstLineBreakTail + 1);
        }

        content = `${headSlice}\n\n[... Omitted sections for context token efficiency ...] \n\n${tailSlice}`;
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
    ? `You have been given ${docCount} documents. Cover EACH document with its own section, explicitly note any overlap or connections between them, and do not omit any major idea.`
    : `You have been given 1 document. Cover it completely.`;

  switch (type) {

    // --------------------------------------------------
    // SUMMARY MODE
    // Goal: Executive-level overview, skimmable in 60s
    // --------------------------------------------------
    case "summary":
      return `You are an expert professional summarizer. Produce a clear, accurate, and easy-to-read summary that covers the full document. Write in plain professional English so a busy reader can understand it on first read.

${docContext}

DOCUMENTS:
${fileTitleList}

RULES:
- Use short, well-formed sentences and avoid long, dense paragraphs.
- Avoid jargon; if a technical term is used, explain it briefly in parentheses.
- Cover the document's main thesis, key sections, important facts, and conclusion.
- Start with a short overview, then use bullets and clear headings.
- Do not add unrelated content or filler.
- If multiple documents are present, give each document its own section and include a final combined insight.
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
      return `You are a top academic tutor creating revision notes that are clear, accurate, and easy to review. Cover the full document with structured headings, bold key terms, and concise bullets.

${docContext}

RULES:
- Use short sentences and clear language.
- Bold key terms and provide brief definitions when needed.
- Organize notes into headings and concise bullets.
- Cover the document's major concepts, details, examples, and conclusions.
- If multiple documents are present, create separate note sections for each document and a combined review section.
- Total length: comprehensive but readable.

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
      return `You are an expert educator who explains documents in a professional, clear, and easy-to-understand way. Use plain language, short sentences, and concrete examples.

${docContext}

RULES:
- Explain each major idea clearly and directly.
- Describe what it is, why it matters, and how it works.
- Use real examples from the documents.
- Keep paragraphs short and use bullets for clarity.
- If a technical term appears, explain it briefly in parentheses.
- Do not add unrelated content or filler.
- Total length: thorough but readable.

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
      summary: { single: 2600, perDoc: 1800, synthesis: 2600 },
      notes: { single: 2800, perDoc: 2000, synthesis: 2800 },
      explain: { single: 3000, perDoc: 2200, synthesis: 3200 },
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
      const perDocOutput = await callGemini(perDocPrompt, apiKey, budget.perDoc);
      perDocResults.push({ fileName: doc.fileName, text: perDocOutput.trim() });
    }

    const synthesisPrompt = buildSynthesisPrompt(type, perDocResults, runDocuments);
    const result = await callGemini(synthesisPrompt, apiKey, budget.synthesis);

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