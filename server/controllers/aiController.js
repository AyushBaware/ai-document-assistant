import { chunkText } from "../utils/chunkText.js";

import { processDocument } from "../utils/processDocument.js";

const GEMINI_MODEL = "gemini-2.5-flash";

const GEMINI_URL =
  `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// ======================================================
// GEMINI REQUEST
// ======================================================

const generateGeminiResponse = async (
  prompt,
  apiKey
) => {

  const response = await fetch(
    GEMINI_URL,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        "x-goog-api-key":
          apiKey,
      },

      body: JSON.stringify({
        contents: [
          {
            role: "user",

            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],

        generationConfig: {
          temperature: 0.3,
          topK: 32,
          topP: 0.9,
          maxOutputTokens: 1500,
        },
      }),
    }
  );

  const data =
    await response.json();

  if (!response.ok) {

    console.log(data);

    throw new Error(
      data.error?.message ||
      "Gemini failed"
    );
  }

  return (
    data.candidates?.[0]
      ?.content?.parts?.[0]?.text || ""
  );
};

// ======================================================
// MAIN RESPONSE PROMPTS
// ======================================================

const buildPrompt = (
  type,
  knowledge
) => {

  switch (type) {

    // ==========================================
    // SUMMARY
    // ==========================================

    case "summary":

      return `
You are an elite AI document summarizer.

Generate a COMPLETE and ACCURATE summary.

STRICT RULES:
- Maximum 350 words
- Cover COMPLETE document
- Avoid repetition
- Professional tone
- Easy to skim
- Use markdown
- Use bullet points
- Keep only important ideas

FORMAT:

# Overview

# Key Takeaways

# Important Concepts

# Final Conclusion

DOCUMENT KNOWLEDGE:

${knowledge}
`;

    // ==========================================
    // NOTES
    // ==========================================

    case "notes":

      return `
You are an elite AI study-notes generator.

Generate COMPLETE revision-friendly notes.

STRICT RULES:
- Cover COMPLETE document
- No giant paragraphs
- Use headings everywhere
- Use bullet points heavily
- Make notes easy to revise
- Keep important details
- Avoid unnecessary theory
- Professional markdown formatting

FORMAT:

# Topic Overview

# Definitions

# Important Concepts

# Examples

# Key Points

# Quick Revision

DOCUMENT KNOWLEDGE:

${knowledge}
`;

    // ==========================================
    // EXPLAIN
    // ==========================================

    case "explain":

      return `
You are an expert teacher and mentor.

Explain the COMPLETE document clearly.

STRICT RULES:
- Cover ALL major concepts
- Explain step-by-step
- Professional tone
- Easy to understand
- No childish language
- No unnecessary storytelling
- Use examples only where useful
- Use markdown formatting
- Break difficult concepts simply
- Keep explanation engaging

FORMAT:

# Topic Overview

# Core Concepts Explained

# Important Details

# Real-World Understanding

# Important Things To Remember

DOCUMENT KNOWLEDGE:

${knowledge}
`;

    default:

      return `
Summarize this document:

${knowledge}
`;
  }
};

// ======================================================
// CHUNK COMPRESSION
// ======================================================

const compressChunk = async (
  chunk,
  apiKey
) => {

  const compressionPrompt = `
You are an intelligent document analyzer.

Extract ONLY the MOST IMPORTANT information.

STRICT RULES:
- Very concise
- No repetition
- No long explanations
- Extract:
  - headings
  - key concepts
  - definitions
  - formulas
  - examples
  - important conclusions

FORMAT:
- Bullet points only
- Maximum 180 words

DOCUMENT:

${chunk}
`;

  return await generateGeminiResponse(
    compressionPrompt,
    apiKey
  );
};

// ======================================================
// MAIN CONTROLLER
// ======================================================

export const generateAIResponse =
  async (req, res) => {

    try {

      const {
        extractedText,
        type,
      } = req.body;

      // ==========================================
      // VALIDATION
      // ==========================================

      if (
        !extractedText ||
        typeof extractedText !==
          "string"
      ) {

        return res
          .status(400)
          .json({
            success: false,

            message:
              "No valid extracted text found.",
          });
      }

      const apiKey =
        process.env.GEMINI_API_KEY;

      if (!apiKey) {

        return res
          .status(500)
          .json({
            success: false,

            message:
              "Gemini API key missing.",
          });
      }

      // ==========================================
      // CLEAN DOCUMENT
      // ==========================================

      const processedText =
        processDocument(
          extractedText
        );

      if (
        !processedText ||
        processedText.trim()
          .length < 50
      ) {

        return res
          .status(400)
          .json({
            success: false,

            message:
              "Unable to extract meaningful content from document.",
          });
      }

      // ==========================================
      // SPLIT INTO CHUNKS
      // ==========================================

      const chunks =
        chunkText(
          processedText,
          12000
        );

      // ==========================================
      // COMPRESS EACH CHUNK
      // ==========================================

      let compressedKnowledge =
        "";

      for (const chunk of chunks) {

        const compressedChunk =
          await compressChunk(
            chunk,
            apiKey
          );

        compressedKnowledge +=
          "\n\n" +
          compressedChunk;
      }

      // ==========================================
      // BUILD FINAL PROMPT
      // ==========================================

      const finalPrompt =
        buildPrompt(
          type,
          compressedKnowledge
        );

      // ==========================================
      // FINAL AI RESPONSE
      // ==========================================

      const finalResponse =
        await generateGeminiResponse(
          finalPrompt,
          apiKey
        );

      // ==========================================
      // RESPONSE
      // ==========================================

      return res
        .status(200)
        .json({
          success: true,

          result:
            finalResponse,
        });

    } catch (error) {

      console.log(
        "Gemini Error:",
        error
      );

      return res
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "AI generation failed",
        });
    }
  };