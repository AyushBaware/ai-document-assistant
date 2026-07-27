import express from "express";
import {
  getNotifications,
  markNotificationRead,
  deleteNotification,
} from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/authMiddleware.js";

const router = express.Router();

router.get("/", requireAuth, getNotifications);
router.patch("/:id/read", requireAuth, markNotificationRead);
router.delete("/:id", requireAuth, deleteNotification);

export default router;
