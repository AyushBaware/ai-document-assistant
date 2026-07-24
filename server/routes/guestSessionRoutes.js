import express from "express";
import {
  saveGuestSession,
  getGuestSession,
  clearGuestSession,
  convertGuestSession,
} from "../controllers/guestSessionController.js";
import { optionalAuth, requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", optionalAuth, saveGuestSession);
router.get("/", optionalAuth, getGuestSession);
router.delete("/", optionalAuth, clearGuestSession);
router.post("/convert", requireAuth, convertGuestSession);

export default router;