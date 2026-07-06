// ============================================================
// chatApi.js
//
// Two functions, same BYOK + session pattern as aiApi.js:
//   askQuestion            → fresh upload
//   askQuestionFromSession → past session (persists to MongoDB)
// ============================================================

import httpClient from "./httpClient";

export const askQuestion = async (
  question,
  selectedDocumentIds = [],
  history = [],
  geminiKey = ""
) => {
  const response = await httpClient.post(
    "/ai/chat",
    { question, selectedDocumentIds, history },
    { headers: { "x-gemini-key": geminiKey } }
  );
  return response.data;
};

export const askQuestionFromSession = async (
  question,
  sessionId,
  history = [],
  geminiKey = "",
  token = ""
) => {
  const response = await httpClient.post(
    "/ai/chat-from-session",
    { question, sessionId, history },
    {
      headers: {
        "x-gemini-key": geminiKey,
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};