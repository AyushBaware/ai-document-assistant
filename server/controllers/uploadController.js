import fs from "fs";
import crypto from "crypto";
import { extractText } from "../utils/extractText.js";
import { generateDisplayName } from "../utils/generateDisplayName.js";
import { createChunks } from "../utils/createChunks.js";
import { embedTexts } from "../utils/embedText.js";
import knowledgeStore from "../utils/knowledgeStore.js";
import DocumentChunk from "../models/DocumentChunk.js";

export const uploadFiles = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ success: false, message: "No files uploaded." });
    }

    const userKey = req.headers["x-gemini-key"];
    const serverKey = process.env.GEMINI_API_KEY;
    const apiKey = (userKey && userKey.startsWith("AIza")) ? userKey : serverKey;

    knowledgeStore.clearDocuments();

    const batchId = crypto.randomUUID();

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
          const displayName = generateDisplayName(extractedText, file.originalname);

          // Hash the full extracted text — identical documents
          // (same content) always produce the same hash, letting
          // us detect "already embedded this exact file before".
          const contentHash = crypto
            .createHash("sha256")
            .update(extractedText)
            .digest("hex");

          const documentObject = {
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            fileName: file.originalname,
            displayName,
            mimetype: file.mimetype,
            extractedText,
            chunks,
            chunkCount: chunks.length,
            batchId,
            contentHash,
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

    // ── EMBED + STORE CHUNKS FOR RAG (with dedupe) ───────────
    if (apiKey) {
      try {
        // For each document, check if this exact content was
        // embedded before (any prior upload — permanent or not).
        // If a full match exists, reuse those vectors instead of
        // calling Gemini again — same content always retrieves
        // identically, so this changes nothing about accuracy.
        const reuseMap = new Map(); // documentId -> ordered embeddings[]

        await Promise.all(
          processedDocs.map(async (doc) => {
            const existing = await DocumentChunk.find({ contentHash: doc.contentHash })
              .sort({ chunkIndex: 1 })
              .limit(doc.chunks.length)
              .lean();

            if (existing.length === doc.chunks.length) {
              reuseMap.set(doc.id, existing.map((e) => e.embedding));
              console.log(
                `[Upload] Reusing existing embeddings for "${doc.fileName}" — skipped Gemini call.`
              );
            }
          })
        );

        // Only chunks from documents WITHOUT a reuse match get
        // sent to Gemini — flattened across docs so it's still
        // as few batched calls as possible.
        const flatChunks = [];
        processedDocs.forEach((doc) => {
          if (reuseMap.has(doc.id)) return;
          doc.chunks.forEach((text, chunkIndex) => {
            flatChunks.push({
              documentId: doc.id,
              fileName: doc.fileName,
              mimetype: doc.mimetype,
              chunkIndex,
              text,
              contentHash: doc.contentHash,
            });
          });
        });

        const embeddings =
          flatChunks.length > 0
            ? await embedTexts(flatChunks.map((c) => c.text), apiKey)
            : [];

        const freshChunkDocs = flatChunks.map((chunk, i) => ({
          batchId,
          documentId: chunk.documentId,
          fileName: chunk.fileName,
          mimetype: chunk.mimetype,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          embedding: embeddings[i],
          contentHash: chunk.contentHash,
        }));

        // Rebuild chunk records for reused documents too — same
        // batchId as this upload, so downstream retrieval scoping
        // (by batchId/documentId) works exactly like a fresh embed.
        const reusedChunkDocs = [];
        processedDocs.forEach((doc) => {
          if (!reuseMap.has(doc.id)) return;
          const vectors = reuseMap.get(doc.id);
          doc.chunks.forEach((text, chunkIndex) => {
            reusedChunkDocs.push({
              batchId,
              documentId: doc.id,
              fileName: doc.fileName,
              mimetype: doc.mimetype,
              chunkIndex,
              text,
              embedding: vectors[chunkIndex],
              contentHash: doc.contentHash,
            });
          });
        });

        await DocumentChunk.insertMany([...freshChunkDocs, ...reusedChunkDocs]);
      } catch (embedErr) {
        console.warn("[Upload] Embedding failed (non-blocking):", embedErr.message);
      }
    } else {
      console.warn("[Upload] No Gemini API key available — skipping embeddings for this batch.");
    }

    const processedFiles = processedDocs.map((doc) => ({
      id: doc.id,
      fileName: doc.fileName,
      displayName: doc.displayName,
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