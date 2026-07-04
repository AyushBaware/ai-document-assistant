import axios from "axios";

// Single shared axios instance — reused TCP connection (keep-alive),
// one place to change the backend URL for prod vs dev, and one place
// to attach auth headers instead of repeating it in every api file.
const httpClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://localhost:5000/api",
});

export const withAuth = (token) => ({
  headers: { Authorization: `Bearer ${token}` },
});

export default httpClient;