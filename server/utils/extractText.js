import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export const extractTextFromPDF = async (filePath) => {

  try {

    const data = new Uint8Array(
      fs.readFileSync(filePath)
    );

    const pdf =
      await pdfjsLib.getDocument({
        data,
      }).promise;

    let extractedText = "";

    for (
      let pageNum = 1;
      pageNum <= pdf.numPages;
      pageNum++
    ) {

      const page =
        await pdf.getPage(pageNum);

      const textContent =
        await page.getTextContent();

      const pageText =
        textContent.items
          .map((item) => item.str)
          .join(" ");

      extractedText +=
        pageText + "\n\n";
    }

    return extractedText;

  } catch (error) {

    console.log(
      "PDF Extraction Error:",
      error
    );

    throw new Error(
      "Failed to extract PDF text"
    );
  }
};