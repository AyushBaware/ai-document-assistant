// ============================================================
// Notification.js
//
// Generic notification record, currently used for one type:
// SECURITY_ALERT — sent to a logged-in user's account when
// their Gemini API key fingerprint is detected on a DIFFERENT
// account/device (see apiKeyController.js saveApiKey()).
//
// Only ever created for owners who HAVE a userId (logged-in
// accounts) — a guest (deviceId only) has no account to attach
// a notification to, so guests are simply excluded from this
// entirely; they'd only start receiving alerts once they log in.
// ============================================================

import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["SECURITY_ALERT"],
      required: true,
    },
    title: { type: String, required: true },
    message: { type: String, required: true },
    isRead: { type: Boolean, default: false },

    // Internal dedup key only — NEVER returned in any API response.
    // Lets us avoid creating a duplicate identical alert every time
    // the same shared key gets saved again.
    relatedFingerprint: { type: String, default: null, select: false },
  },
  { timestamps: true }
);

const Notification = mongoose.model("Notification", notificationSchema);

export default Notification;