// Purpose: Uploads documents for text extraction and processing.

import httpClient from "./httpClient";

export const uploadFiles = async (formData) => {
  const response = await httpClient.post("/upload", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });

  return response.data;
};