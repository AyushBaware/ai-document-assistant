// Purpose: Registers document generation and chat endpoints.

import express from "express";
import { generateAIResponse, generateFromSession } from "../controllers/aiController.js";
import { askQuestion, askQuestionFromSession } from "../controllers/chatController.js";
import { requireAuth, optionalAuth } from "../middleware/authMiddleware.js";
import { checkGuestLimit } from "../middleware/guestLimitMiddleware.js";
import { attachApiKey } from "../middleware/apiKeyMiddleware.js";

const router = express.Router();

router.post("/generate",               optionalAuth, attachApiKey, checkGuestLimit, generateAIResponse);
router.post("/generate-from-session",  requireAuth, attachApiKey, generateFromSession);
router.post("/chat",                   optionalAuth, attachApiKey, checkGuestLimit, askQuestion);
router.post("/chat-from-session",      requireAuth, attachApiKey, askQuestionFromSession);

export default router;