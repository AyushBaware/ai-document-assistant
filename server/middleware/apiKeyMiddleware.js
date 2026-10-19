// Purpose: Loads and decrypts the API key for the current user or device.

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