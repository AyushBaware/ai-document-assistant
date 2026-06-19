// ============================================================
// extractText.js
//
// WHAT THIS DOES:
// Extracts text from PDF, DOCX, PPTX, TXT, and Images.
//
// HONEST LIMITATION (documented, not hidden):
// This extracts the TEXT LAYER of documents. It does NOT
// perform OCR on images/charts embedded INSIDE PDFs or PPTs.
// Standalone image uploads (screenshots) DO get OCR via
// Tesseract — that works fully.
//
// WHY NOT OCR EVERY PAGE OF EVERY PDF?
// Rendering PDF pages to images requires either:
//   1. The 'canvas' npm package — needs native compilation
//      (Cairo, node-gyp, Python build tools). Breaks easily
//      on Windows machines without Visual Studio Build Tools.
//   2. External binaries like Poppler — not installed by
//      default on Windows, adds setup friction for every
//      person who clones this project.
// Both options trade project portability for partial accuracy
// gains, while also increasing Gemini token usage per upload.
// For this project's scope, text-layer extraction with
// honest gap detection is the right engineering tradeoff.
//
// WHAT WE IMPROVED INSTEAD:
// 1. TABLE STRUCTURE RECONSTRUCTION — PDF text is extracted
//    with X/Y position data. We now group text by row (Y
//    coordinate) so tables read as structured rows instead
//    of one jumbled line. This directly improves accuracy
//    for any document containing tables.
// 2. CONTENT DENSITY DETECTION — if a PDF/PPTX has very
//    little extractable text relative to its page count,
//    we flag it. This tells Gemini (via the content profile
//    in aiController.js) that the document may contain
//    significant image/chart content it cannot see — so
//    Gemini says so honestly instead of inventing content
//    to fill gaps. This is what "not biased" means in
//    practice: the AI admits what it cannot see.
// ============================================================

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

  let text = "";
  let totalTextLength = 0;

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();

    // Use row-aware grouping instead of flat join — preserves tables
    const pageText = groupTextByRows(content.items);
    totalTextLength += pageText.length;

    text += pageText + "\n\n";
  }

  // ── CONTENT DENSITY CHECK ──────────────────────────────
  // Average chars per page. A normal text-heavy page has
  // 1500-3000+ characters. If average is very low, the PDF
  // likely contains scanned images, charts, or diagrams with
  // no extractable text layer — flag this honestly.
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