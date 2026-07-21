import express from "express";
import { saveApiKey, getApiKeyStatus } from "../controllers/apiKeyController.js";
import { optionalAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", optionalAuth, saveApiKey);
router.get("/status", optionalAuth, getApiKeyStatus);

export default router;