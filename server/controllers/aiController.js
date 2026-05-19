import { chunkText } from "../utils/chunkText.js";

import { processDocument } from "../utils/processDocument.js";

const GEMINI_MODEL = "gemini-2.5-flash";

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const generateGeminiResponse = async (prompt, apiKey) => {
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
        maxOutputTokens: 1800,
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.log(data);

    throw new Error(data.error?.message || "Gemini failed");
  }

  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
};

const buildPrompt = (type, document) => {
  switch (type) {
    case "summary":
      return `
You are an elite AI document summarizer.

Your job is to help users
understand documents quickly.

IMPORTANT:
The summary should SAVE time.

STRICT RULES:
- Maximum 220 words
- Extremely concise
- Avoid repetition
- Avoid unnecessary details
- Professional tone
- Easy to skim quickly
- Focus only on most important concepts
- Keep cognitive load low
- Response should feel premium
- Use proper markdown formatting
- Use bullets wherever useful

FORMAT STRICTLY:

# Overview
- short overview

# Key Takeaways
- important points

# Important Concepts
- major concepts explained briefly

# Final Conclusion
- final understanding

DOCUMENT:
${document}
`;

    case "notes":
      return `
You are a world-class AI study assistant.

Generate BEAUTIFUL and
REVISION-FRIENDLY notes.

IMPORTANT:
The notes should help students
revise quickly before exams.

STRICT RULES:
- No giant paragraphs
- Use headings everywhere
- Use bullet points heavily
- Add spacing between sections
- Keep information structured
- Keep explanations concise
- Highlight important concepts
- Use clean markdown formatting
- Make notes visually scannable
- Keep notes complete but compact
- Make learning effortless

FORMAT STRICTLY:

# Topic Overview

# Definitions
- important definitions

# Important Concepts
- bullet points

# Examples
- useful examples

# Quick Revision
- short revision points

DOCUMENT:
${document}
`;

    case "explain":
      return `
You are an expert teacher.

Explain this content in a
clear, intelligent,
and professional way.

IMPORTANT:
The explanation should feel like:
- a great mentor
- NOT childish
- NOT robotic
- NOT overly academic

STRICT RULES:
- Explain concepts clearly
- Use simple but intelligent language
- Break difficult ideas into smaller parts
- Use examples only where useful
- Avoid unnecessary storytelling
- Avoid long paragraphs
- Keep explanation structured
- Keep explanation engaging
- Keep cognitive load low
- Focus on understanding, not complexity
- Use markdown formatting professionally

FORMAT STRICTLY:

# Topic Overview

# Core Concepts Explained

# Real-World Understanding

# Important Things To Remember

DOCUMENT:
${document}
`;

    default:
      return `
Summarize this document:

${document}
`;
  }
};

export const generateAIResponse = async (req, res) => {
  try {
    const { extractedText, type } = req.body;

    if (!extractedText) {
      return res.status(400).json({
        success: false,

        message: "No extracted text",
      });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({
        success: false,

        message: "Gemini API key missing",
      });
    }

    // STEP 1:
    // CLEAN DOCUMENT

    const processedText = processDocument(extractedText);

    // STEP 2:
    // OPTIMIZE LENGTH

    const optimizedText = chunkText(processedText);

    // STEP 3:
    // BUILD SMART PROMPT

    const prompt = buildPrompt(type, optimizedText);

    // STEP 4:
    // GENERATE RESPONSE

    const finalResponse = await generateGeminiResponse(prompt, apiKey);

    return res.status(200).json({
      success: true,

      result: finalResponse,
    });
  } catch (error) {
    console.log("Gemini Error:", error);

    return res.status(500).json({
      success: false,

      message: error.message || "AI generation failed",
    });
  }
};
