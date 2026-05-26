import multer from "multer";

const storage =
  multer.diskStorage({

    destination:
      (req, file, cb) => {

        cb(
          null,
          "uploads/"
        );
      },

    filename:
      (req, file, cb) => {

        const uniqueName =

          Date.now()
          + "-"
          + file.originalname
            .replace(/\s+/g, "-");

        cb(
          null,
          uniqueName
        );
      },
  });

const allowedMimeTypes = [

  // PDF
  "application/pdf",

  // DOC
  "application/msword",

  // DOCX
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",

  // PPT
  "application/vnd.ms-powerpoint",

  // PPTX
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",

  // TXT
  "text/plain",
];

const fileFilter =
(req, file, cb) => {

  if (
    allowedMimeTypes.includes(
      file.mimetype
    )
  ) {

    cb(null, true);

  } else {

    cb(
      new Error(
        "Only PDF, DOC, DOCX, PPT, PPTX, and TXT files are allowed."
      )
    );
  }
};

const upload = multer({

  storage,

  fileFilter,

  limits: {

    fileSize:
      25 * 1024 * 1024,
  },
});

export default upload;