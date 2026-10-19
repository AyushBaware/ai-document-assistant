// Purpose: Assigns a persistent device ID using a secure cookie.

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
      // "lax" is now correct in BOTH environments — the Vercel rewrite
      // makes the frontend and backend appear same-site to the browser
      // in production, and localhost:5173 → localhost:5000 is already
      // same-site in dev. "none" is no longer needed and was the
      // looser, more permissive setting — safe to drop it now that
      // we don't have a genuine cross-site cookie situation anymore.
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
    });
  }

  req.deviceId = deviceId;
  next();
};
