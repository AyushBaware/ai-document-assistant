import httpClient from "./httpClient";

export const saveGuestSession = async ({ documents, selectedIds, batchId, chatHistory }) => {
  const response = await httpClient.post("/guest-session", {
    documents,
    selectedIds,
    batchId,
    chatHistory,
  });
  return response.data;
};

export const getGuestSession = async () => {
  const response = await httpClient.get("/guest-session");
  return response.data;
};

export const clearGuestSession = async () => {
  const response = await httpClient.delete("/guest-session");
  return response.data;
};

export const convertGuestSession = async (token) => {
  const response = await httpClient.post(
    "/guest-session/convert",
    {},
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return response.data;
};