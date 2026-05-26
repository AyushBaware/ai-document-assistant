import fs from "fs";

import { extractText }
from "../utils/extractText.js";

export const uploadFile =
async (req, res) => {

  try {

    if (!req.file) {

      return res.status(400)
      .json({

        success: false,

        message:
          "No file uploaded",
      });
    }

    const extractedText =
      await extractText(

        req.file.path,

        req.file.mimetype
      );

    // Optional cleanup
    fs.unlinkSync(
      req.file.path
    );

    return res.status(200)
    .json({

      success: true,

      message:
        "File uploaded successfully",

      extractedText,
    });

  } catch (error) {

    console.log(
      "Upload Error:",
      error
    );

    return res.status(500)
    .json({

      success: false,

      message:
        "File processing failed",
    });
  }
};