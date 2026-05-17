import axios from "axios";

const API =
  "http://localhost:5000/api/ai/generate";

export const generateAI = async (
  extractedText,
  type
) => {

  const response =
    await axios.post(API, {
      extractedText,
      type,
    });

  return response.data;
};