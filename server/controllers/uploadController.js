import path from "path";
import { extractTextFromPDF } from "../utils/extractText.js";

export const uploadFile = async (req, res) => {

  try {

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No file uploaded",
      });
    }

    const filePath = req.file.path;

    const extension = path.extname(
      req.file.originalname
    );

    let extractedText = "";

    if (extension === ".pdf") {

      extractedText =
        await extractTextFromPDF(filePath);

    } else {

      extractedText =
        "Text extraction for this file type coming soon.";
    }

    res.status(200).json({
      success: true,
      message: "File uploaded successfully",
      file: req.file,
      extractedText,
    });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};