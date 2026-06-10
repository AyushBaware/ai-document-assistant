import fs from "fs";
import { extractText } from "../utils/extractText.js";
import { createChunks } from "../utils/createChunks.js";
import knowledgeStore from "../utils/knowledgeStore.js";

export const uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files uploaded.",
      });
    }

    // CRITICAL: Clear old documents before processing new upload.
    // Without this, clicking "Process" a second time would append
    // new docs to old ones, causing duplicate/wrong responses.
    knowledgeStore.clearDocuments();

    const processedFiles = [];

    for (const file of req.files) {
      const extractedText = await extractText(file.path, file.mimetype);

      if (!extractedText || extractedText.trim().length < 20) {
        // Skip files that produced no readable text
        console.warn(`Could not extract text from: ${file.originalname}`);
        fs.unlinkSync(file.path);
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

      // Store in knowledge store (RAG memory layer)
      knowledgeStore.addDocument(documentObject);

      processedFiles.push({
        id: documentObject.id,
        fileName: file.originalname,
        mimetype: file.mimetype,
        extractedText, // Sent back so frontend can confirm extraction worked
        chunkCount: chunks.length,
      });

      // Clean up uploaded temp file
      fs.unlinkSync(file.path);
    }

    if (processedFiles.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No readable text found in uploaded files. Please check the files.",
      });
    }

    return res.status(200).json({
      success: true,
      files: processedFiles,
      totalDocuments: processedFiles.length,
    });

  } catch (error) {
    console.error("Upload Error:", error);
    return res.status(500).json({
      success: false,
      message: "File processing failed. Please try again.",
    });
  }
};