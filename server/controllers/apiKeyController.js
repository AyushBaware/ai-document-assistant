// ============================================================
// apiKeyController.js
//
// Two endpoints:
//   POST /api/apikey         → encrypt + save the user's key
//   GET  /api/apikey/status  → tell the frontend "yes/no" only,
//                              NEVER the raw or decrypted key
// ============================================================

import ApiKey from "../models/ApiKey.js";
import GuestUsage from "../models/GuestUsage.js";
import { encrypt } from "../utils/crypto.js";
import { GUEST_REQUEST_LIMIT } from "../middleware/guestLimitMiddleware.js";

const isValidKeyFormat = (key = "") => key.startsWith("AIza") && key.length >= 35;

export const saveApiKey = async (req, res) => {
  try {
    const { apiKey } = req.body;
    const deviceId = req.deviceId;
    const userId = req.userId || null; // set by optionalAuth if a valid JWT was sent

    if (!apiKey || !isValidKeyFormat(apiKey.trim())) {
      return res.status(400).json({
        success: false,
        message: "This doesn't look like a valid Gemini API key.",
      });
    }

    const { encryptedData, iv, authTag } = encrypt(apiKey.trim());

    const update = { encryptedData, iv, authTag };
    if (userId) update.userId = userId;

    await ApiKey.findOneAndUpdate(
      { deviceId },
      { $set: update, $setOnInsert: { deviceId } },
      { upsert: true, new: true }
    );

    return res.status(200).json({ success: true, message: "API key saved securely." });
  } catch (error) {
    console.error("Save API Key Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to save API key." });
  }
};

export const getApiKeyStatus = async (req, res) => {
  try {
    const record = await ApiKey.findOne({ deviceId: req.deviceId }).select("_id");

    const response = { success: true, hasKey: !!record };

    // Only meaningful for anonymous users — logged-in users aren't
    // capped by this counter at all. Sourced from GuestUsage (keyed
    // by IP) instead of the old ApiKey.guestRequestCount (keyed by
    // deviceId) — see guestLimitMiddleware.js for why: deviceId is a
    // client-resettable cookie, IP is not.
    if (!req.userId) {
      const usage = await GuestUsage.findOne({ ip: req.ip }).select("requestCount");
      const usedCount = usage?.requestCount || 0;
      response.guestRequestsRemaining = Math.max(0, GUEST_REQUEST_LIMIT - usedCount);
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Get API Key Status Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to check API key status." });
  }
};