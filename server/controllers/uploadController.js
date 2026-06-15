import fs from "fs";
import { extractText } from "../utils/extractText.js";
import { createChunks } from "../utils/createChunks.js";
import knowledgeStore from "../utils/knowledgeStore.js";

export const uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No files uploaded." });
    }

    knowledgeStore.clearDocuments();
    const processedFiles = [];

    for (const file of req.files) {
      const extractedText = await extractText(file.path, file.mimetype);

      if (!extractedText || extractedText.trim().length < 20) {
        console.warn(`Could not extract text from: ${file.originalname}`);
        if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
        continue;
      }

      const chunks = createChunks(extractedText);

      const documentObject = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        fileName: file.originalname,
        mimetype: file.mimetype,
        extractedText,
        chunks,
        chunkCount: chunks.length,
        uploadedAt: new Date().toISOString(),
      };

      knowledgeStore.addDocument(documentObject);

      // OPTIMIZATION: Do not pass raw extractedText back to client.
      // Keep payload lightweight to protect browser memory performance.
      processedFiles.push({
        id: documentObject.id,
        fileName: file.originalname,
        mimetype: file.mimetype,
        chunkCount: chunks.length,
      });

      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
    }

    if (processedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message:
          "No readable text found in uploaded files. Please check the files.",
      });
    }

    return res.status(200).json({
      success: true,
      files: processedFiles,
      totalDocuments: processedFiles.length,
    });
  } catch (error) {
    console.error("Upload Error:", error);
    return res
      .status(500)
      .json({
        success: false,
        message: "File processing failed. Please try again.",
      });
  }
};
