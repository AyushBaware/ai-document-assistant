import axios from "axios";

const API =
  "http://localhost:5000/api/upload";

export const uploadFiles =
  async (files) => {

    const formData =
      new FormData();

    files.forEach((file) => {

      formData.append(
        "files",
        file
      );
    });

    const response =
      await axios.post(
        API,
        formData,
        {
          headers: {
            "Content-Type":
              "multipart/form-data",
          },
        }
      );

    return response.data;
};