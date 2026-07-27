import httpClient, { withAuth } from "./httpClient";

export const getNotifications = async (token) => {
  const response = await httpClient.get("/notifications", withAuth(token));
  return response.data;
};

export const markNotificationRead = async (id, token) => {
  const response = await httpClient.patch(
    `/notifications/${id}/read`,
    {},
    withAuth(token)
  );
  return response.data;
};

export const deleteNotification = async (id, token) => {
  const response = await httpClient.delete(`/notifications/${id}`, withAuth(token));
  return response.data;
};