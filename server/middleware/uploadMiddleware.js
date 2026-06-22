// ============================================================
// uploadMiddleware.js
//
// SECURITY FIX: File extension validation added alongside
// MIME type checking.
//
// WHY THIS MATTERS:
// The MIME type (file.mimetype) that multer checks is reported
// by the CLIENT'S BROWSER, not verified by the server. A
// malicious user could rename a script file to "resume.pdf"
// and many browsers would still report a fake/spoofed MIME
// type, potentially slipping past a MIME-only check. Adding
// an extension check as a second layer makes this meaningfully
// harder to bypass — both checks must agree.
//
// NOTE: True deep validation (checking actual file bytes/magic
// numbers) is a further hardening step possible with a library
// like 'file-type', but for this project's threat model
// (a document analysis tool, not a system that executes
// uploaded files), MIME + extension matching is a reasonable,
// proportionate level of validation.
// ============================================================

import multer from "multer";
import path from "path";

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    // Sanitize filename — strip any path traversal attempts
    // and collapse whitespace, in addition to the timestamp
    // prefix which already guarantees uniqueness.
    const safeName = path
      .basename(file.originalname)
      .replace(/\s+/g, "-");
    const uniqueName = `${Date.now()}-${safeName}`;
    cb(null, uniqueName);
  },
});

const allowedMimeTypes = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
];

const allowedExtensions = [
  ".pdf", ".doc", ".docx", ".ppt", ".pptx", ".txt",
  ".png", ".jpg", ".jpeg", ".webp",
];

const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();

  const mimeOk = allowedMimeTypes.includes(file.mimetype);
  const extOk = allowedExtensions.includes(ext);

  if (mimeOk && extOk) {
    cb(null, true);
  } else {
    cb(
      new Error(
        "Only PDF, DOC, DOCX, PPT, PPTX, TXT, PNG, JPG, JPEG, and WEBP files are allowed."
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB
    files: 10, // max files per upload request — prevents abuse via huge batches
  },
});

export default upload;