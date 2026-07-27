// ============================================================
// notificationController.js
//
// Two endpoints, both requireAuth (a guest has no account to
// look notifications up against):
//
//   GET   /api/notifications          → list current user's notifications
//   PATCH /api/notifications/:id/read → mark one as read
//
// PRIVACY: the .select() below deliberately excludes anything
// that could identify the OTHER account/device involved in a
// SECURITY_ALERT (no deviceId, no other userId, no email) —
// the user only ever learns "your key was used elsewhere."
// ============================================================

import Notification from "../models/Notification.js";

export const getNotifications = async (req, res) => {
  try {
    const userId = req.userId;

    const notifications = await Notification.find({ userId })
      .sort({ createdAt: -1 })
      .select("type title message isRead createdAt")
      .limit(50)
      .lean();

    return res.status(200).json({ success: true, notifications });
  } catch (error) {
    console.error("Get Notifications Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to fetch notifications." });
  }
};

export const markNotificationRead = async (req, res) => {
  try {
    const userId = req.userId;
    const { id } = req.params;

    // Filtering by userId too — a user can never mark (or even
    // confirm the existence of) another user's notification by
    // guessing an id in the URL.
    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isRead: true } },
      { new: true }
    ).select("_id");

    if (!notification) {
      return res.status(404).json({ success: false, message: "Notification not found." });
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error("Mark Notification Read Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to update notification." });
  }
};