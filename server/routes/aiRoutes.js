// ============================================================
// aiRoutes.js
//
// ROUTES:
//
//   POST /api/ai/generate
//   → Fresh upload flow. Reads documents from in-memory
//     knowledgeStore. No auth required (anonymous uploads
//     work). Rate limiter applied in server.js.
//
//   POST /api/ai/generate-from-session
//   → Past session flow. Reads document text from MongoDB.
//     requireAuth is mandatory — we need req.userId to
//     confirm the session belongs to this user.
//
//   POST /api/ai/chat
//   → "Ask Questions" for a fresh upload. Uses RAG retrieval
//     (top-k relevant chunks) instead of sending the whole
//     document — cheaper and more accurate for Q&A.
//
//   POST /api/ai/chat-from-session
//   → "Ask Questions" for a saved past session. requireAuth
//     mandatory — verifies ownership before touching any
//     stored chunks, and persists the conversation.
// ============================================================

import express from "express";
import { generateAIResponse, generateFromSession } from "../controllers/aiController.js";
import { askQuestion, askQuestionFromSession } from "../controllers/chatController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/generate",               generateAIResponse);
router.post("/generate-from-session",  requireAuth, generateFromSession);
router.post("/chat",                   askQuestion);
router.post("/chat-from-session",      requireAuth, askQuestionFromSession);

export default router;