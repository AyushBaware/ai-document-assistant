// ============================================================
// sessionApi.js
//
// CHANGED: createSession now sends documentIds (array of
// strings) instead of full document objects. The backend
// pulls the actual extractedText from its own knowledgeStore —
// see sessionController.js header comment for why.
// ============================================================

import axios from "axios";

const SESSION_API = "http://localhost:5000/api/sessions";

const authHeader = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

// Save a new session — sends only document IDs, not full text
export const createSession = async (documentIds, token) => {
  const response = await axios.post(
    SESSION_API,
    { documentIds },
    authHeader(token)
  );
  return response.data;
};

export const getAllSessions = async (token) => {
  const response = await axios.get(SESSION_API, authHeader(token));
  return response.data;
};

export const getSessionById = async (sessionId, token) => {
  const response = await axios.get(
    `${SESSION_API}/${sessionId}`,
    authHeader(token)
  );
  return response.data;
};

export const updateSessionResponse = async (sessionId, type, result, tokenBudget, token) => {
  const response = await axios.patch(
    `${SESSION_API}/${sessionId}`,
    { type, result, tokenBudget },
    authHeader(token)
  );
  return response.data;
};

export const deleteSession = async (sessionId, token) => {
  const response = await axios.delete(
    `${SESSION_API}/${sessionId}`,
    authHeader(token)
  );
  return response.data;
};