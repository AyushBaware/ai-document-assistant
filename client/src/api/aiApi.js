// ============================================================
// aiApi.js
//
// TWO FUNCTIONS:
//
//   generateAI()
//   → Called after a fresh upload. Sends selectedDocumentIds
//     (the IDs that exist in the server's knowledgeStore).
//
//   generateAIFromSession()
//   → Called when the user loads a past session from history
//     and clicks Summary/Notes/Explain. Sends the real MongoDB
//     sessionId instead of document IDs, because the fake
//     "preloaded-0" IDs that UploadBox assigns for display
//     don't exist in knowledgeStore.
//
// Both functions send the Gemini API key in the x-gemini-key
// header — the BYOK pattern from Phase 1. The backend uses
// the user's key if present and valid, otherwise falls back
// to the server's .env key.
// ============================================================

import axios from "axios";

const BASE = "http://localhost:5000/api/ai";

export const generateAI = async (
  _extractedText,        // unused — backend reads from knowledgeStore
  type,                  // "summary" | "notes" | "explain"
  selectedDocumentIds = [],
  geminiKey = ""
) => {
  const body = { type };

  if (Array.isArray(selectedDocumentIds) && selectedDocumentIds.length > 0) {
    body.selectedDocumentIds = selectedDocumentIds;
  }

  const response = await axios.post(`${BASE}/generate`, body, {
    headers: { "x-gemini-key": geminiKey },
  });

  return response.data;
};

export const generateAIFromSession = async (
  sessionId,             // real MongoDB session _id
  type,                  // "summary" | "notes" | "explain"
  geminiKey = "",
  token = ""             // JWT — required because the backend uses requireAuth
) => {
  const response = await axios.post(
    `${BASE}/generate-from-session`,
    { type, sessionId },
    {
      headers: {
        "x-gemini-key":  geminiKey,
        "Authorization": `Bearer ${token}`,
      },
    }
  );

  return response.data;
};