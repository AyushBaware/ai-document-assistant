// ============================================================
// aiApi.js
//
// WHAT CHANGED:
// Now accepts geminiKey as a parameter and sends it
// in the request header "x-gemini-key".
//
// WHY HEADERS AND NOT REQUEST BODY?
// The API key is metadata about the request (who is making
// it) rather than data being processed. HTTP headers are
// the standard place for auth credentials — same pattern
// used by every API in the industry (Bearer tokens, API
// keys, etc). The backend reads it from req.headers.
//
// IMPORTANT: This is sent over HTTPS in production,
// so the key is encrypted in transit. Never send API
// keys over plain HTTP in production.
// ============================================================

import axios from "axios";

const AI_API = "http://localhost:5000/api/ai/generate";

export const generateAI = async (
  _extractedText,       // unused — backend reads from knowledgeStore
  type,                 // "summary" | "notes" | "explain"
  selectedDocumentIds = [],
  geminiKey = ""        // user's personal Gemini API key
) => {
  const body = { type };

  if (Array.isArray(selectedDocumentIds) && selectedDocumentIds.length > 0) {
    body.selectedDocumentIds = selectedDocumentIds;
  }

  const response = await axios.post(AI_API, body, {
    headers: {
      // Send the API key in a custom header.
      // Backend reads: req.headers["x-gemini-key"]
      "x-gemini-key": geminiKey,
    },
  });

  return response.data;
};