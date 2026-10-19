// Purpose: Calls backend endpoints for document analysis and glossary generation.

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