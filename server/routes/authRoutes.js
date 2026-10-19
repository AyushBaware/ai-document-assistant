// Purpose: Registers Google sign-in and current-user endpoints.

import express from "express";
import { googleAuth, getCurrentUser } from "../controllers/authController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/google", googleAuth);
router.get("/me", requireAuth, getCurrentUser);

export default router;