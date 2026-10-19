// Purpose: Stores uploaded files and validates their types and size limits.

import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Absolute path, independent of process.cwd() — works the same
// locally, on Render, in Docker, etc.
const UPLOAD_DIR = path.join(__dirname, "..", "uploads");

// Ensure it exists before multer ever tries to write to it —
// git doesn't track empty folders, so on a fresh clone/deploy
// this directory won't exist unless we create it ourselves.
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
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
    const err = new Error(
      "Only PDF, DOC, DOCX, PPT, PPTX, TXT, PNG, JPG, JPEG, and WEBP files are allowed."
    );
    err.statusCode = 400;
    cb(err);
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