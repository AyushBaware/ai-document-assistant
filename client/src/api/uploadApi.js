// ============================================================
// uploadApi.js
//
// UPDATED: now sends the Gemini API key on upload too (not just
// on Summary/Notes/Explain). Uploads now trigger embedding
// generation on the backend for RAG — that needs a key.
// ============================================================

import httpClient from "./httpClient";

export const uploadFiles = async (files) => {
  const formData = new FormData();

  files.forEach((file) => {
    formData.append("files", file);
  });

  const response = await httpClient.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
};