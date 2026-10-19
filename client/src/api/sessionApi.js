// Purpose: Creates and retrieves saved document sessions.

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
  glossary = [],
  selectedFileNames = []
) => {
  const response = await httpClient.patch(
    `/sessions/${sessionId}`,
    { type, result, tokenBudget, glossary, selectedFileNames },
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