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
// 20000 chars ≈ 5000 tokens — keeps costs low
const MAX_CHARS_PER_DOC = 20000;

// ======================================================
// GEMINI REQUEST
// ======================================================

const callGemini = async (prompt, apiKey) => {
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
        temperature: 0.4,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 3000, // Raised from 1800 — prevents cut-off responses
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

const buildPrompt = (type, knowledge, docCount) => {
  const multiDoc = docCount > 1;
  const docContext = multiDoc
    ? `You have been given ${docCount} documents. Cover EACH document. Where concepts overlap or connect across documents, explicitly note those connections.`
    : `You have been given 1 document. Cover it completely.`;

  switch (type) {

    // --------------------------------------------------
    // SUMMARY MODE
    // Goal: Executive-level overview, skimmable in 60s
    // --------------------------------------------------
    case "summary":
      return `You are an expert academic summarizer. Your summaries are known for being precise, complete, and easy to skim.

${docContext}

RULES:
- Write in clean markdown
- Be specific — include actual names, numbers, techniques, case studies from the documents
- No filler phrases like "This document discusses..." — go straight to the substance
- Each bullet must carry real information, not vague descriptions
- If multiple documents, give each its own titled section, then a combined insights section
- Total length: 400–600 words

OUTPUT FORMAT (use exactly these headers):

${multiDoc ? `# Document Summaries\n\n## [Document Name 1]\n[summary]\n\n## [Document Name 2]\n[summary]\n\n---\n\n# Combined Key Insights\n[cross-document connections and unified takeaways]` : `# Overview\n[2-3 sentence high-level summary]\n\n# Key Points\n[bullet list of most important facts/concepts]\n\n# Important Details\n[specifics: names, numbers, techniques, examples]\n\n# Conclusion\n[what this document ultimately shows or argues]`}

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
  ? `# Study Notes\n\n## 📄 [Document 1 Name]\n\n### Overview\n### Key Concepts\n### Definitions\n### Important Examples / Case Studies\n### Key Takeaways\n\n---\n\n## 📄 [Document 2 Name]\n\n[same structure]\n\n---\n\n## ⚡ Quick Revision — All Documents\n[Combined bullet list of every important term and fact across all documents]`
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
  ? `# Deep Explanation\n\n## 📘 [Document 1 Topic]\n\n### What This Is About\n### Core Concepts Explained\n### How It Works (Step by Step if applicable)\n### Real Examples from the Document\n### Why This Matters\n\n---\n\n## 📘 [Document 2 Topic]\n\n[same structure]\n\n---\n\n## 🔗 Connections Between Documents\n[How the topics relate, contrast, or build on each other]`
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

    if (!allDocuments || allDocuments.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No documents found. Please upload and process files first.",
      });
    }

    // Build structured knowledge context
    const knowledge = buildKnowledge(allDocuments);

    // Build mode-specific prompt
    const prompt = buildPrompt(type, knowledge, allDocuments.length);

    // Call Gemini
    const result = await callGemini(prompt, apiKey);

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