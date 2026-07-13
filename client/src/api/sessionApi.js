// ============================================================
// sessionApi.js
//
// CHANGED: createSession now sends documentIds (array of
// strings) instead of full document objects. The backend
// pulls the actual extractedText from its own knowledgeStore —
// see sessionController.js header comment for why.
//
// OPTIMIZED: now uses the shared httpClient instance instead of
// raw axios + a hardcoded base URL — reuses connections and
// keeps the backend URL in one place (httpClient.js).
// ============================================================

import httpClient, { withAuth } from "./httpClient";

// Save a new session — sends only document IDs, not full text
export const createSession = async (documentIds, batchId, token) => {
  const response = await httpClient.post(
    "/sessions",
    { documentIds, batchId },
    withAuth(token)
  );
  return response.data;
};

export const getAllSessions = async (token) => {
  const response = await httpClient.get("/sessions", withAuth(token));
  return response.data;
};

export const getSessionById = async (sessionId, token) => {
  const response = await httpClient.get(
    `/sessions/${sessionId}`,
    withAuth(token)
  );
  return response.data;
};

export const updateSessionResponse = async (
  sessionId,
  type,
  result,
  tokenBudget,
  token,
  glossary = []
) => {
  const response = await httpClient.patch(
    `/sessions/${sessionId}`,
    { type, result, tokenBudget, glossary },
    withAuth(token)
  );
  return response.data;
};

export const deleteSession = async (sessionId, token) => {
  const response = await httpClient.delete(
    `/sessions/${sessionId}`,
    withAuth(token)
  );
  return response.data;
};