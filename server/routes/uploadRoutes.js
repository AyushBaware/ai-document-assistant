import express from "express";
import upload from "../middleware/uploadMiddleware.js";
import { uploadFiles } from "../controllers/uploadController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";
import { attachApiKey } from "../middleware/apiKeyMiddleware.js";

const router = express.Router();

router.post(
  "/",
  optionalAuth,
  attachApiKey,
  upload.array("files", 10),
  uploadFiles
);

export default router;