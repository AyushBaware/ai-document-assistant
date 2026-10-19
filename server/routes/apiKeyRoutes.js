// Purpose: Registers endpoints to save, check, and delete API keys.

import express from "express";
import { saveApiKey, getApiKeyStatus, deleteApiKey } from "../controllers/apiKeyController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", optionalAuth, saveApiKey);
router.get("/status", optionalAuth, getApiKeyStatus);
router.delete("/", optionalAuth, deleteApiKey);

export default router;