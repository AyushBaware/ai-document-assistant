// ============================================================
// authRoutes.js
//
// WHAT THIS DOES:
// Maps URLs to controller functions. This file follows the
// exact same pattern as your existing uploadRoutes.js and
// aiRoutes.js — Express Router lets you organize routes by
// feature instead of cramming everything into server.js.
//
// ROUTES DEFINED:
// POST /api/auth/google  → verify Google login, issue our JWT
// GET  /api/auth/me      → check current logged-in user
//                           (protected — requires valid JWT)
// ============================================================

import express from "express";
import { googleAuth, getCurrentUser } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/google", googleAuth);
router.get("/me", requireAuth, getCurrentUser);

export default router;