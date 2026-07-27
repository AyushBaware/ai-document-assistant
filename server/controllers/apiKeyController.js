// ============================================================
// apiKeyController.js
//
// Two endpoints:
//   POST /api/apikey         → encrypt + save the user's key
//   GET  /api/apikey/status  → tell the frontend "yes/no" only,
//                              NEVER the raw or decrypted key
// ============================================================

import ApiKey from "../models/ApiKey.js";
import GuestIpUsage from "../models/GuestIpUsage.js";
import Notification from "../models/Notification.js";
import { encrypt, hashKeyForDedup } from "../utils/crypto.js";
import { GUEST_REQUEST_LIMIT, getClientIp } from "../middleware/guestLimitMiddleware.js";

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

    const trimmedKey = apiKey.trim();
    const { encryptedData, iv, authTag } = encrypt(trimmedKey);
    const keyFingerprint = hashKeyForDedup(trimmedKey);

    // ── SHARED-KEY DETECTION ────────────────────────────────
    // Same fingerprint already saved under a DIFFERENT identity
    // (different deviceId, and — if logged in — a different
    // userId) means this exact Gemini key is in use by someone
    // else too. We never block the save (a false positive here
    // would lock a legitimate user out of their own key), but we
    // log it server-side and surface a flag to the frontend so
    // the user can be warned their key may be compromised.
    const sharedWith = await ApiKey.find({
      keyFingerprint,
      deviceId: { $ne: deviceId },
      ...(userId ? { userId: { $ne: userId } } : {}),
    }).select("deviceId userId");

    const isShared = sharedWith.length > 0;
    if (isShared) {
      console.warn(
        `[ApiKey] Fingerprint collision: key saved by deviceId=${deviceId}` +
        `${userId ? ` (userId=${userId})` : " (guest)"} matches ` +
        `${sharedWith.length} other record(s) already using this key. ` +
        `Possible key leak/sharing.`
      );

      // ── NOTIFY THE ORIGINAL OWNER(S) ────────────────────────
      // Only owners with a real userId can be notified — a guest
      // (deviceId only, no account) has nowhere for a notification
      // to attach to. This never blocks the current save either way.
      try {
        const ownerIdsToNotify = [
          ...new Set(
            sharedWith
              .filter((r) => r.userId)
              .map((r) => r.userId.toString())
          ),
        ];

        for (const ownerId of ownerIdsToNotify) {
          // Dedup — don't re-alert the same owner for the same key
          // every single time it gets reused/re-saved.
          const alreadyAlerted = await Notification.findOne({
            userId: ownerId,
            type: "SECURITY_ALERT",
            relatedFingerprint: keyFingerprint,
            isRead: false,
          }).select("_id");

          if (!alreadyAlerted) {
            await Notification.create({
              userId: ownerId,
              type: "SECURITY_ALERT",
              title: "Security Alert",
              message:
                "Another account or device has registered a session using your Gemini API key.",
              relatedFingerprint: keyFingerprint,
            });
          }
        }
      } catch (notifyErr) {
        console.warn("[ApiKey] Failed to create security notification (non-blocking):", notifyErr.message);
      }
    }

    const update = { encryptedData, iv, authTag, keyFingerprint };
    if (userId) update.userId = userId;

    await ApiKey.findOneAndUpdate(
      { deviceId },
      { $set: update, $setOnInsert: { deviceId } },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: "API key saved securely.",
      keyShared: isShared, // frontend can show a warning banner if true
    });
  } catch (error) {
    console.error("Save API Key Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to save API key." });
  }
};

export const getApiKeyStatus = async (req, res) => {
  try {
    const record = await ApiKey.findOne({ deviceId: req.deviceId }).select("_id guestRequestCount");
    const response = { success: true, hasKey: !!record };

    if (!req.userId) {
      const ip = getClientIp(req);
      const usage = await GuestIpUsage.findOne({ ip }).select("requestCount");
      const usedCount = Math.max(record?.guestRequestCount || 0, usage?.requestCount || 0);
      response.guestRequestsRemaining = Math.max(0, GUEST_REQUEST_LIMIT - usedCount);
    }

    return res.status(200).json(response);
  } catch (error) {
    console.error("Get API Key Status Error:", error.message);
    return res.status(500).json({ success: false, message: "Failed to check API key status." });
  }
};