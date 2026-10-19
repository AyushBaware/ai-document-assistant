// Purpose: Defines the MongoDB schema for user notifications.

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