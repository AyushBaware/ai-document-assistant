// ============================================================
// crypto.js
//
// AES-256-GCM encrypt/decrypt for the user's Gemini API key.
// The encryption secret lives ONLY in server/.env — never in
// the database, never sent to the frontend. GCM mode also
// gives us an authTag, which detects if the encrypted data was
// ever tampered with (not just decrypts it).
// ============================================================

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // recommended IV size for GCM

const getEncryptionKey = () => {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET;
  if (!secret) {
    throw new Error(
      "API_KEY_ENCRYPTION_SECRET is not set in server/.env — required to store user API keys."
    );
  }
  // Hashes whatever string length is provided down to a valid 32-byte key
  return crypto.createHash("sha256").update(secret).digest();
};

export const encrypt = (plainText) => {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return {
    encryptedData: encrypted.toString("hex"),
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
};

export const decrypt = ({ encryptedData, iv, authTag }) => {
  const key = getEncryptionKey();
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));

  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedData, "hex")),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
};