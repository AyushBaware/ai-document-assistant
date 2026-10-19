// Purpose: Creates and dispatches user notification records.

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