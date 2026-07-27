// ============================================================
// ApiKey.js
//
// Stores each user's Gemini API key encrypted at rest, keyed
// by deviceId (an httpOnly cookie — works whether or not the
// person is logged in). If they ARE logged in, userId is also
// attached, so the key follows their account across devices.
// ============================================================

import mongoose from "mongoose";

const apiKeySchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true, unique: true },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },
    encryptedData: { type: String, required: true },
    iv: { type: String, required: true },
    authTag: { type: String, required: true },

    // Deterministic HMAC of the plaintext key (see crypto.js
    // hashKeyForDedup) — lets us detect the SAME Gemini key being
    // saved under a different deviceId/userId, which encryptedData
    // alone can never reveal (random IV makes ciphertext differ
    // every time, even for the identical key).
    keyFingerprint: { type: String, index: true, default: null },

    // Not enforced until Phase 2 — counts Gemini-calling requests
    // made by this guest (deviceId) before they log in.
    guestRequestCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const ApiKey = mongoose.model("ApiKey", apiKeySchema);

export default ApiKey;