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
import { parseUserAgent } from "../utils/parseUserAgent.js";
import { enforceNotificationLimit } from "../utils/notificationHelpers.js";
import { GUEST_REQUEST_LIMIT, getClientIp } from "../middleware/guestLimitMiddleware.js";

// ── FORMAT CHECK (instant, no network call) ──────────────────
// Google currently issues Gemini keys in two formats: legacy
// "AIzaSy..." and the newer dot-separated "AQ.Ab8...". This only
// rejects obviously-wrong strings — the real check is the live
// call below, since a string like "AQ.randomtext123" would still
// pass this regex but isn't a real key.
const KEY_FORMAT_REGEX = /^(AIzaSy|AQ\.)[A-Za-z0-9_-]+$/;
const isValidKeyFormat = (key = "") => KEY_FORMAT_REGEX.test(key);

// ── LIVE VERIFICATION AGAINST GOOGLE ──────────────────────────
// listModels is a lightweight, read-only catalog endpoint — it
// does NOT call generateContent, so it does not consume the
// user's daily content-generation quota. This is what actually
// confirms the key works, rather than just "looks right".
const GEMINI_MODELS_URL = "https://generativelanguage.googleapis.com/v1beta/models";

const verifyGeminiKeyIsLive = async (apiKey) => {
  try {
    const response = await fetch(`${GEMINI_MODELS_URL}?key=${encodeURIComponent(apiKey)}`);

    if (response.ok) {
      return { isValid: true };
    }

    const data = await response.json().catch(() => ({}));
    const message = data?.error?.message || "";

    // Map Google's error into the same user-facing language used
    // elsewhere in this app (aiController.js classifyError).
    if (response.status === 400 || response.status === 401 || response.status === 403) {
      return {
        isValid: false,
        message: "This API key is invalid or not authorized. Please double-check it in Google AI Studio.",
      };
    }

    console.warn(`[ApiKey] Live verification non-OK (${response.status}):`, message);
    return {
      isValid: false,
      message: "Couldn't verify this key with Google right now. Please try again in a moment.",
    };
  } catch (err) {
    console.warn("[ApiKey] Live verification network error:", err.message);
    // Fail open on our own network/infra issues — don't block a
    // possibly-valid key just because our server briefly couldn't
    // reach Google. Format check has already passed at this point.
    return { isValid: true, skippedDueToNetworkError: true };
  }
};

export const saveApiKey = async (req, res) => {
  try {
    const { apiKey } = req.body;
    const deviceId = req.deviceId;
    const userId = req.userId || null; // set by optionalAuth if a valid JWT was sent

    if (!apiKey || !isValidKeyFormat(apiKey.trim())) {
      return res.status(400).json({
        success: false,
        message: "This doesn't look like a valid Gemini API key. Keys start with 'AIzaSy' or 'AQ.'.",
      });
    }

    const trimmedKey = apiKey.trim();

    // Live check against Google BEFORE saving anything — catches
    // fake/typo'd keys that merely pass the format regex (e.g.
    // "AQ.randomtext123"). Uses listModels, which does not count
    // against the user's daily content-generation quota.
    const liveCheck = await verifyGeminiKeyIsLive(trimmedKey);
    if (!liveCheck.isValid) {
      return res.status(400).json({
        success: false,
        message: liveCheck.message,
      });
    }

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

      // ── NOTIFY THE ORIGINAL OWNER(S) — ANONYMOUS CONTEXT ONLY ──
      // Only owners with a real userId can be notified — a guest
      // (deviceId only, no account) has nowhere for a notification
      // to attach to. This never blocks the current save either way.
      //
      // PRIVACY: the message below deliberately contains ONLY
      // anonymous context (when, and what kind of device/browser) —
      // never the other person's name, email, userId, or IP. This
      // still gives the original owner enough to tell "this was my
      // own other device" from "someone else has my key", without
      // exposing anyone's identity.
      try {
        const deviceContext = parseUserAgent(req.headers["user-agent"]);
        const eventTime = new Date().toLocaleString("en-US", {
          dateStyle: "medium",
          timeStyle: "short",
        });
        const alertMessage =
          `A device running ${deviceContext} registered a session using your ` +
          `Gemini API key on ${eventTime}. If this wasn't you, please delete ` +
          `this key in Google AI Studio and generate a new one to protect your quota.`;

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
              title: "Duplicate API Key Registered",
              message: alertMessage,
              relatedFingerprint: keyFingerprint,
            });
            await enforceNotificationLimit(ownerId);
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