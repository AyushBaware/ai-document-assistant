import fs from "fs";

import mammoth from "mammoth";

import path from "path";

import Tesseract from "tesseract.js";

import officeParser from "officeparser";

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// ================= PDF =================

const extractPdfText = async (filePath) => {
  const data = new Uint8Array(fs.readFileSync(filePath));

  const pdf = await pdfjsLib.getDocument({
    data,
  }).promise;

  let text = "";

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);

    const content = await page.getTextContent();

    const strings = content.items.map((item) => item.str);

    text += strings.join(" ") + "\n\n";
  }

  return text;
};

// ================= DOCX =================

const extractDocxText = async (filePath) => {
  const result = await mammoth.extractRawText({
    path: filePath,
  });

  return result.value;
};

// ================= OCR =================

const runOCR = async (imagePath) => {
  try {
    const {
      data: { text },
    } = await Tesseract.recognize(imagePath, "eng", {
      logger: () => {},
    });

    return text;
  } catch (error) {
    console.log("OCR Error:", error);

    return "";
  }
};

// ================= PPTX =================

const extractPptxText =
async (filePath) => {

  try {

    // =================
    // EXTRACT PPT TEXT
    // =================

    const pptText =
  await new Promise(
    (resolve, reject) => {

      officeParser.parseOffice(
        filePath,

        (data, error) => {

          if (error) {

            reject(error);

          } else {

            let cleanText = "";

            // STRING RESPONSE

            if (
              typeof data === "string"
            ) {

              cleanText = data;

            }

            // OBJECT RESPONSE

            else if (
              typeof data === "object"
            ) {

              cleanText =
                JSON.stringify(
                  data,
                  null,
                  2
                );
            }

            resolve(cleanText);
          }
        }
      );
    }
  );

    let finalText =
      pptText || "";

    // =================
    // OCR IMAGE SUPPORT
    // =================

    const uploadsFolder =
      path.join(
        process.cwd(),
        "uploads"
      );

    const files =
      fs.readdirSync(
        uploadsFolder
      );

    const imageFiles =
      files.filter(
        (file) =>
          file.endsWith(".png") ||
          file.endsWith(".jpg") ||
          file.endsWith(".jpeg")
      );

    for (const imageFile of imageFiles) {

      const imagePath =
        path.join(
          uploadsFolder,
          imageFile
        );

      const ocrText =
        await runOCR(
          imagePath
        );

      // REMOVE SMALL NOISE

      if (
        ocrText &&
        ocrText.trim().length > 50
      ) {

        finalText +=
          "\n\n" +
          ocrText;
      }
    }

    return finalText;

  } catch (error) {

    console.log(
      "PPTX Extraction Error:",
      error
    );

    return "";
  }
};

// ================= TXT =================

const extractTxtText = (filePath) => {
  return fs.readFileSync(filePath, "utf-8");
};

// ================= MAIN =================

export const extractText = async (filePath, mimetype) => {
  try {
    // PDF

    if (mimetype === "application/pdf") {
      return await extractPdfText(filePath);
    }

    // DOCX

    if (
      mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return await extractDocxText(filePath);
    }

    // PPTX

    if (
      mimetype ===
      "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    ) {
      return await extractPptxText(filePath);
    }

    // TXT

    if (mimetype === "text/plain") {
      return extractTxtText(filePath);
    }

    return "Unsupported file type";
  } catch (error) {
    console.log("Extraction Error:", error);

    return "";
  }
};
