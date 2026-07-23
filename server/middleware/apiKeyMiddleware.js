// ============================================================
// apiKeyMiddleware.js
//
// Looks up the caller's saved Gemini key (by userId if logged
// in, otherwise by deviceId) and decrypts it onto req.geminiApiKey.
// Controllers now read from here instead of an "x-gemini-key"
// header — the raw key never has to travel from the browser
// again after it's first saved.
// ============================================================

import ApiKey from "../models/ApiKey.js";
import { decrypt } from "../utils/crypto.js";

export const attachApiKey = async (req, res, next) => {
  try {
    let record = null;

    if (req.userId) {
      record = await ApiKey.findOne({ userId: req.userId });
    }
    if (!record && req.deviceId) {
      record = await ApiKey.findOne({ deviceId: req.deviceId });
    }

    req.geminiApiKey = record
      ? decrypt({
          encryptedData: record.encryptedData,
          iv: record.iv,
          authTag: record.authTag,
        })
      : null;

    next();
  } catch (error) {
    console.error("Attach API Key Error:", error.message);
    req.geminiApiKey = null;
    next();
  }
};