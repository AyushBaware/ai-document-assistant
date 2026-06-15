import fs from "fs";
import mammoth from "mammoth";
import path from "path";
import Tesseract from "tesseract.js";
import officeParser from "officeparser";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// ================= OCR ENGINE (Images & Screenshots) =================
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

// ================= PDF EXTRACTION =================
const extractPdfText = async (filePath) => {
  const data = new Uint8Array(fs.readFileSync(filePath));
  const pdf = await pdfjsLib.getDocument({ data }).promise;

  let text = "";
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const strings = content.items.map((item) => item.str);
    text += strings.join(" ") + "\n\n";
  }
  return text;
};

// ================= DOCX EXTRACTION =================
const extractDocxText = async (filePath) => {
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
};

// ================= PPTX EXTRACTION =================
const extractPptxText = async (filePath) => {
  try {
    // 1. Extract native text layout structures
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

    let finalText = pptText || "";

    // 2. Local-only contextual image safety check
    // Optimization: Only run OCR if the target presentation points directly to an asset
    const uploadsFolder = path.dirname(filePath);
    const files = fs.readdirSync(uploadsFolder);

    // Identify if images exist specifically matching this transaction thread time window
    const imageFiles = files.filter(
      (file) =>
        (file.endsWith(".png") ||
          file.endsWith(".jpg") ||
          file.endsWith(".jpeg")) &&
        path.basename(filePath, path.extname(filePath)) in file,
    );

    for (const imageFile of imageFiles) {
      const imagePath = path.join(uploadsFolder, imageFile);
      const ocrText = await runOCR(imagePath);

      if (ocrText && ocrText.trim().length > 50) {
        finalText += "\n\n--- Extracted Slide Graphic Text ---\n" + ocrText;
      }
    }

    return finalText;
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

    // NEW FEATURE: Native Direct Standalone Image Scan (PNG/JPEG/JPG)
    if (
      mimetype === "image/png" ||
      mimetype === "image/jpeg" ||
      mimetype === "image/jpg"
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
    // Propagate cleanly up to controller to trigger error states
    throw error;
  }
};
