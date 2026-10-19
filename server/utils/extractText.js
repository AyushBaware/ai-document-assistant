// Purpose: Extracts readable text from supported document formats.

import fs from "fs";
import mammoth from "mammoth";
import Tesseract from "tesseract.js";
import officeParser from "officeparser";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// ================= OCR ENGINE (Standalone Images) =================
const runOCR = async (imagePath) => {
  try {
    const {
      data: { text },
    } = await Tesseract.recognize(imagePath, "eng", {
      logger: () => {}, // Keeps console clean
    });
    return text || "";
  } catch (error) {
    console.error("OCR Core Processing Error:", error);
    return "";
  }
};

// ================= TABLE-AWARE PDF TEXT GROUPING =================
// pdfjs-dist returns each text fragment with x/y coordinates.
// Plain extraction (item.str joined with spaces) destroys
// table structure — a 3-column row becomes one run-on string.
//
// FIX: Group text items by their Y position (same row = same
// line). Within a row, sort by X position (left to right).
// This reconstructs tables as readable rows instead of noise.
//
// Y_TOLERANCE: items within this many pixels vertically are
// treated as being on the same visual line. PDFs render text
// with tiny sub-pixel Y differences even on the same line, so
// exact equality would wrongly split single rows.
const Y_TOLERANCE = 3;

const groupTextByRows = (items) => {
  if (!items || items.length === 0) return "";

  // Sort all items by Y position (top to bottom), then X (left to right)
  const sorted = [...items].sort((a, b) => {
    const yDiff = b.transform[5] - a.transform[5]; // PDF Y axis is bottom-up
    if (Math.abs(yDiff) > Y_TOLERANCE) return yDiff;
    return a.transform[4] - b.transform[4]; // same row: sort left to right
  });

  const rows = [];
  let currentRow = [];
  let currentY = null;

  for (const item of sorted) {
    const y = item.transform[5];

    if (currentY === null || Math.abs(y - currentY) <= Y_TOLERANCE) {
      currentRow.push(item.str);
      currentY = y;
    } else {
      if (currentRow.length > 0) rows.push(currentRow.join(" ").trim());
      currentRow = [item.str];
      currentY = y;
    }
  }
  if (currentRow.length > 0) rows.push(currentRow.join(" ").trim());

  return rows.filter((r) => r.length > 0).join("\n");
};

// ================= PDF EXTRACTION =================
const extractPdfText = async (filePath) => {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  // Extract all pages concurrently — page.getTextContent() calls are
  // independent, so this avoids serializing N awaits into one long chain.
  // Promise.all preserves order, so the final text stays page-ordered.
  const pageTexts = await Promise.all(
    Array.from({ length: pdf.numPages }, async (_, i) => {
      const page = await pdf.getPage(i + 1);
      const content = await page.getTextContent();
      return groupTextByRows(content.items);
    })
  );

  const totalTextLength = pageTexts.reduce((sum, t) => sum + t.length, 0);
  let text = pageTexts.join("\n\n") + "\n\n";

  const avgCharsPerPage = totalTextLength / pdf.numPages;
  const isLikelyImageHeavy = avgCharsPerPage < 200 && pdf.numPages > 0;

  if (isLikelyImageHeavy) {
    text += `\n\n[SYSTEM NOTE: This PDF has very little extractable text (avg ${Math.round(avgCharsPerPage)} chars/page across ${pdf.numPages} pages). It likely contains scanned content, charts, diagrams, or images that could not be read as text. Any AI response based on this document may be incomplete for visual content.]\n`;
  }

  return text;
};

// ================= DOCX EXTRACTION =================
const extractDocxText = async (filePath) => {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
};

// ================= PPTX EXTRACTION =================
// officeparser extracts text directly from slide XML — this
// captures titles, body text, and text boxes accurately since
// PowerPoint stores these as real text objects, not images.
// Charts/images embedded in slides are not OCR'd (see header
// note for why), but text content extraction is reliable.
const extractPptxText = async (filePath) => {
  try {
    const pptText = await new Promise((resolve, reject) => {
      officeParser.parseOffice(filePath, (data, error) => {
        if (error) {
          reject(error);
        } else {
          let cleanText = "";
          if (typeof data === "string") {
            cleanText = data;
          } else if (typeof data === "object") {
            cleanText = JSON.stringify(data, null, 2);
          }
          resolve(cleanText);
        }
      });
    });

    const text = pptText || "";

    // Same density check as PDF — flag slide-heavy-on-images decks
    if (text.trim().length < 300) {
      return (
        text +
        `\n\n[SYSTEM NOTE: This presentation has very little extractable text (${text.trim().length} characters total). It likely relies heavily on charts, diagrams, or image-based slides that could not be read as text.]\n`
      );
    }

    return text;
  } catch (error) {
    console.error("PPTX Extraction Error:", error);
    throw error;
  }
};

// ================= TXT EXTRACTION =================
const extractTxtText = (filePath) => {
  return fs.readFileSync(filePath, "utf-8");
};

// ================= MAIN MATRIX ROUTER =================
export const extractText = async (filePath, mimetype) => {
  try {
    // PDF Ingestion
    if (mimetype === "application/pdf") {
      return await extractPdfText(filePath);
    }

    // Word Document Ingestion
    if (
      mimetype === "application/msword" ||
      mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return await extractDocxText(filePath);
    }

    // PowerPoint Ingestion
    if (
      mimetype === "application/vnd.ms-powerpoint" ||
      mimetype ===
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
      return await extractPptxText(filePath);
    }

    // Raw Text File Ingestion
    if (mimetype === "text/plain") {
      return extractTxtText(filePath);
    }

    // Standalone Image Scan (PNG/JPEG/JPG/WEBP) via OCR
    if (
      mimetype === "image/png" ||
      mimetype === "image/jpeg" ||
      mimetype === "image/jpg" ||
      mimetype === "image/webp"
    ) {
      const parsedOcrText = await runOCR(filePath);
      if (!parsedOcrText || parsedOcrText.trim().length === 0) {
        return "Warning: Image upload succeeded, but no legible text characters could be found by the OCR engine.";
      }
      return parsedOcrText;
    }

    return "Unsupported file type";
  } catch (error) {
    console.error("Critical Extraction Pipeline Failure:", error);
    throw error;
  }
};