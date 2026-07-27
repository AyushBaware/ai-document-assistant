// ============================================================
// notificationHelpers.js
//
// Same "rolling window" pattern as sessionHelpers.js's
// enforceSessionLimit — caps how many notifications pile up
// per user so the list never grows unbounded. Called right
// after every new notification is created.
// ============================================================

import Notification from "../models/Notification.js";

const NOTIFICATION_LIMIT_PER_USER = 3;

export const enforceNotificationLimit = async (userId) => {
  const count = await Notification.countDocuments({ userId });

  if (count > NOTIFICATION_LIMIT_PER_USER) {
    const excessCount = count - NOTIFICATION_LIMIT_PER_USER;

    const oldest = await Notification.find({ userId })
      .sort({ createdAt: 1 })
      .limit(excessCount)
      .select("_id");

    const idsToDelete = oldest.map((n) => n._id);

    if (idsToDelete.length > 0) {
      await Notification.deleteMany({ _id: { $in: idsToDelete } });
    }
  }
};