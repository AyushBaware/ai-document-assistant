// Purpose: Sends document-grounded chat messages to the backend.

import httpClient from "./httpClient";

export const askQuestion = async (
  question,
  selectedDocumentIds = [],
  history = []
) => {
  const response = await httpClient.post("/ai/chat", {
    question,
    selectedDocumentIds,
    history,
  });
  return response.data;
};

export const askQuestionFromSession = async (
  question,
  sessionId,
  history = [],
  geminiKey = "", // unused now — kept so call-site argument order stays intact
  token = "",
  selectedFileNames = [] // narrows retrieval to only these files, if provided
) => {
  const response = await httpClient.post(
    "/ai/chat-from-session",
    { question, sessionId, history, selectedFileNames },
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );
  return response.data;
};