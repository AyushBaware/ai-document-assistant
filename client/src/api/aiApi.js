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
//
// OPTIMIZED: uses the shared httpClient instance instead of
// raw axios + a hardcoded base URL.
// ============================================================

import httpClient from "./httpClient";

export const generateAI = async (
  batchId,                // REQUIRED now — scopes the lookup to this upload
  type,                   // "summary" | "notes" | "explain"
  selectedDocumentIds = []
) => {
  const body = { type, batchId };

  if (Array.isArray(selectedDocumentIds) && selectedDocumentIds.length > 0) {
    body.selectedDocumentIds = selectedDocumentIds;
  }

  // The Gemini key is resolved securely on the backend now — never
  // sent from the browser.
  const response = await httpClient.post("/ai/generate", body);

  return response.data;
};

export const generateAIFromSession = async (
  sessionId,             // real MongoDB session _id
  type,                  // "summary" | "notes" | "explain"
  geminiKey = "",        // unused now — kept so call-site argument order stays intact
  token = "",            // JWT — required because the backend uses requireAuth
  selectedFileNames = [] // narrows generation to only these files, if provided
) => {
  const response = await httpClient.post(
    "/ai/generate-from-session",
    { type, sessionId, selectedFileNames },
    {
      headers: {
        "Authorization": `Bearer ${token}`,
      },
    }
  );

  return response.data;
};