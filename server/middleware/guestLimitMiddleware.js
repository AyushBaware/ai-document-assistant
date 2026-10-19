// Purpose: Tracks guest usage by device and IP and enforces the free limit.

import ApiKey from "../models/ApiKey.js";
import GuestIpUsage from "../models/GuestIpUsage.js";

export const GUEST_REQUEST_LIMIT = 5;

export const getClientIp = (req) =>
  req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || "unknown";

export const checkGuestLimit = async (req, res, next) => {
  try {
    if (req.userId) return next();

    const deviceId = req.deviceId;
    const ip = getClientIp(req);

    // ATOMIC increment-then-check. findOneAndUpdate is a single atomic
    // operation in MongoDB — this closes the race the old find-then-save
    // version had: firing several requests at once meant every one of
    // them could read "4 used" before any had written "5", letting more
    // than 5 through. Now each request's increment is indivisible —
    // whichever lands first genuinely claims that slot.
    const [deviceRecord, ipRecord] = await Promise.all([
      deviceId
        ? ApiKey.findOneAndUpdate(
            { deviceId },
            { $inc: { guestRequestCount: 1 } },
            { new: true }
          )
        : null,
      GuestIpUsage.findOneAndUpdate(
        { ip },
        { $inc: { requestCount: 1 } },
        { upsert: true, new: true }
      ),
    ]);

    const deviceCount = deviceRecord?.guestRequestCount ?? 0;
    const ipCount = ipRecord?.requestCount ?? 0;

    if (deviceCount > GUEST_REQUEST_LIMIT || ipCount > GUEST_REQUEST_LIMIT) {
      return res.status(403).json({
        success: false,
        code: "GUEST_LIMIT_REACHED",
        message: "You've used all 5 free guest requests. Please sign in to keep generating responses.",
      });
    }

    const remaining = Math.max(0, GUEST_REQUEST_LIMIT - Math.max(deviceCount, ipCount));
    res.set("X-Guest-Requests-Remaining", String(remaining));

    next();
  } catch (error) {
    console.error("Guest Limit Check Error:", error.message);
    next(); // fail open, unchanged
  }
};