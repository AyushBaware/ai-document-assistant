import axios from "axios";

const AI_API = "http://localhost:5000/api/ai/generate";

// NOTE: We do NOT send extractedText from frontend.
// The backend (aiController) reads directly from knowledgeStore,
// which was populated during the upload step.
// Frontend only tells the backend WHAT to do (type),
// backend decides HOW using stored document knowledge.

export const generateAI = async (_extractedText, type) => {
  const response = await axios.post(AI_API, { type });
  return response.data;
};