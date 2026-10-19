// Purpose: Registers endpoints to create, retrieve, update, and delete sessions.

import express from "express";
import {
  createSession,
  getAllSessions,
  getSessionById,
  updateSessionResponse,
  deleteSession,
} from "../controllers/sessionController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/", requireAuth, createSession);
router.get("/", requireAuth, getAllSessions);
router.get("/:id", requireAuth, getSessionById);
router.patch("/:id", requireAuth, updateSessionResponse);
router.delete("/:id", requireAuth, deleteSession);

export default router;