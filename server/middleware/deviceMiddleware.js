// ============================================================
// deviceMiddleware.js
//
// Assigns every visitor a stable, anonymous deviceId via an
// httpOnly cookie — separate from the Google/JWT auth cookie
// entirely. This is what lets someone use the app without
// logging in: their API key and guest request count are
// looked up by this id, not by userId.
//
// httpOnly means client-side JS can never read or tamper with
// it (unlike localStorage) — meaningfully safer.
// ============================================================

import crypto from "crypto";

const COOKIE_NAME = "documind_device_id";
const COOKIE_MAX_AGE = 1000 * 60 * 60 * 24 * 365; // 1 year

export const assignDeviceId = (req, res, next) => {
  let deviceId = req.cookies?.[COOKIE_NAME];

  if (!deviceId) {
    deviceId = crypto.randomUUID();
    res.cookie(COOKIE_NAME, deviceId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  req.deviceId = deviceId;
  next();
};