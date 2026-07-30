import httpClient from "./httpClient";

export const saveApiKey = async (apiKey) => {
  const response = await httpClient.post("/apikey", { apiKey });
  return response.data;
};

export const getApiKeyStatus = async () => {
  const response = await httpClient.get("/apikey/status");
  return response.data;
};

export const deleteApiKey = async () => {
  const response = await httpClient.delete("/apikey");
  return response.data;
};