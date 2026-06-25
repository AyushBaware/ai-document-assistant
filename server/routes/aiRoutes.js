// ============================================================
// aiRoutes.js
//
// TWO ROUTES:
//
//   POST /api/ai/generate
//   → Fresh upload flow. Reads documents from in-memory
//     knowledgeStore. No auth required (anonymous uploads
//     work). Rate limiter applied in server.js.
//
//   POST /api/ai/generate-from-session
//   → Past session flow. Reads document text from MongoDB.
//     requireAuth is mandatory — we need req.userId to
//     confirm the session belongs to this user before
//     reading any stored document text from it.
// ============================================================

import express from "express";
import { generateAIResponse, generateFromSession } from "../controllers/aiController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/generate",               generateAIResponse);
router.post("/generate-from-session",  requireAuth, generateFromSession);

export default router;