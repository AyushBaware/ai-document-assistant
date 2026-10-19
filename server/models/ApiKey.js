// Purpose: Defines the MongoDB schema for encrypted user API keys.

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

    // Counts Gemini requests made by this device before sign-in.
    guestRequestCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

const ApiKey = mongoose.model("ApiKey", apiKeySchema);

export default ApiKey;