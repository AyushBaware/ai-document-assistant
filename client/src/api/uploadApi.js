import axios from "axios";

const API = "http://localhost:5000/api/upload";

export const uploadFile = async (file) => {
  const formData = new FormData();

  formData.append("file", file);

  const response = await axios.post(
    API,
    formData,
    {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    }
  );

  return response.data;
};