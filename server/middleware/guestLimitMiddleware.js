// ============================================================
// guestLimitMiddleware.js
//
// Caps anonymous (not-logged-in) usage of Gemini-calling routes
// to a fixed lifetime total — not daily, not resettable by
// clearing cookies alone (the count lives server-side against
// the deviceId, not in the browser).
//
// LOGGED-IN USERS ARE NEVER CAPPED HERE — req.userId being set
// (by optionalAuth, which must run before this) skips the check
// entirely. Their own account-level limits, if any, are handled
// elsewhere.
//
// COUNTS ATTEMPTS, NOT SUCCESSES — the count increments the
// moment a request is allowed through, before Gemini is called.
// This keeps the logic simple and can't be bypassed by retrying
// a failed request.
//
// FAILS OPEN — if the DB check itself errors out, we let the
// request through rather than blocking real usage over an
// infrastructure hiccup.
// ============================================================

import ApiKey from "../models/ApiKey.js";

export const GUEST_REQUEST_LIMIT = 5;

export const checkGuestLimit = async (req, res, next) => {
  try {
    // Logged-in users are handled by a separate policy (or none) —
    // this middleware only ever applies to anonymous requests.
    if (req.userId) return next();

    const deviceId = req.deviceId;
    const record = await ApiKey.findOne({ deviceId });

    // No saved key yet for this device — the controller's own
    // "No Gemini API key found" check will handle this case.
    if (!record) return next();

    if (record.guestRequestCount >= GUEST_REQUEST_LIMIT) {
      return res.status(403).json({
        success: false,
        code: "GUEST_LIMIT_REACHED",
        message:
          "You've used all 5 free guest requests. Please sign in to keep generating responses.",
      });
    }

    record.guestRequestCount += 1;
    await record.save();

    // Exposed via a response header so the frontend can show a
    // "4 of 5 used" style nudge without a separate API call.
    res.set(
      "X-Guest-Requests-Remaining",
      String(Math.max(0, GUEST_REQUEST_LIMIT - record.guestRequestCount))
    );

    next();
  } catch (error) {
    console.error("Guest Limit Check Error:", error.message);
    next();
  }
};