// ============================================================
// uploadApi.js
//
// OPTIMIZED: uses the shared httpClient instance instead of
// raw axios + a hardcoded base URL.
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