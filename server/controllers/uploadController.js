import fs from "fs";
import crypto from "crypto";
import { extractText } from "../utils/extractText.js";
import { createChunks } from "../utils/createChunks.js";
import { embedTexts } from "../utils/embedText.js";
import knowledgeStore from "../utils/knowledgeStore.js";
import DocumentChunk from "../models/DocumentChunk.js";

export const uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded." });
    }

    // Same BYOK pattern as aiController.js — user's key wins,
    // falls back to server key. Only used for embeddings here;
    // extraction itself never needed a key and still doesn't.
    const userKey = req.headers["x-gemini-key"];
    const serverKey = process.env.GEMINI_API_KEY;
    const apiKey = (userKey && userKey.startsWith("AIza")) ? userKey : serverKey;

    knowledgeStore.clearDocuments();

    // Process all files concurrently instead of one-by-one.
    // Each file's extraction is independent (own path/buffer), so this
    // cuts total upload time roughly to the slowest single file
    // instead of the sum of all files.
    const results = await Promise.all(
      req.files.map(async (file) => {
        try {
          const extractedText = await extractText(file.path, file.mimetype);

          if (!extractedText || extractedText.trim().length < 20) {
            console.warn(`Could not extract text from: ${file.originalname}`);
            if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
            return null;
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

          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return documentObject;
        } catch (err) {
          console.error(`Failed processing ${file.originalname}:`, err.message);
          if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
          return null;
        }
      })
    );

    const processedDocs = results.filter(Boolean);

    if (processedDocs.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No readable text found in uploaded files. Please check the files.",
      });
    }

    processedDocs.forEach((doc) => knowledgeStore.addDocument(doc));

    // ── EMBED + STORE CHUNKS FOR RAG ─────────────────────────
    // One batchId ties every chunk from this upload together,
    // so a later Session save can flip them all to permanent
    // in a single update (see sessionController.js).
    const batchId = crypto.randomUUID();

    if (apiKey) {
      try {
        // Flatten every document's chunks into one list so the
        // whole upload embeds in as few Gemini calls as possible
        // (embedTexts batches internally, up to 100 per call).
        const flatChunks = [];
        processedDocs.forEach((doc) => {
          doc.chunks.forEach((text, chunkIndex) => {
            flatChunks.push({
              documentId: doc.id,
              fileName: doc.fileName,
              mimetype: doc.mimetype,
              chunkIndex,
              text,
            });
          });
        });

        const embeddings = await embedTexts(
          flatChunks.map((c) => c.text),
          apiKey
        );

        const chunkDocs = flatChunks.map((chunk, i) => ({
          batchId,
          documentId: chunk.documentId,
          fileName: chunk.fileName,
          mimetype: chunk.mimetype,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          embedding: embeddings[i],
        }));

        await DocumentChunk.insertMany(chunkDocs);
      } catch (embedErr) {
        // Embedding failure must NOT block the upload — existing
        // Summary/Notes/Explain modes work off knowledgeStore
        // regardless. Semantic search just won't be available
        // for this batch until it's re-uploaded.
        console.warn("[Upload] Embedding failed (non-blocking):", embedErr.message);
      }
    } else {
      console.warn("[Upload] No Gemini API key available — skipping embeddings for this batch.");
    }

    const processedFiles = processedDocs.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      mimetype: doc.mimetype,
      chunkCount: doc.chunkCount,
    }));

    return res.status(200).json({
      success: true,
      files: processedFiles,
      totalDocuments: processedFiles.length,
      batchId,
    });
  } catch (error) {
    console.error("Upload Error:", error);
    return res.status(500).json({ success: false, message: "File processing failed. Please try again." });
  }
};