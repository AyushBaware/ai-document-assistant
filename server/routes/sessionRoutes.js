// ============================================================
// sessionRoutes.js
//
// Every route here uses requireAuth — saving/viewing history
// is a logged-in-only feature, per our design. Compare this to
// aiRoutes.js and uploadRoutes.js, which remain UNCHANGED and
// still work without login (per your "optional login" decision).
// ============================================================

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