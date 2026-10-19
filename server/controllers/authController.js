// Purpose: Verifies Google login credentials and issues app tokens.

import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import ApiKey from "../models/ApiKey.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const client = new OAuth2Client(GOOGLE_CLIENT_ID);

// ── HELPER: Generate our own JWT for a given user ──────────
const generateAppToken = (userId) => {
  return jwt.sign(
    { userId },              // payload — what's stored inside the token
    process.env.JWT_SECRET,  // our secret key — signs the token so it
                              // can't be forged or tampered with
    { expiresIn: "7d" }      // token auto-expires after 7 days
  );
};

// POST /api/auth/google: verifies Google credentials and returns an app token.

export const googleAuth = async (req, res) => {
  try {
    const { credential } = req.body; // The Google ID Token (JWT)

    if (!credential) {
      return res.status(400).json({
        success: false,
        message: "No Google credential provided.",
      });
    }

    // ── VERIFY THE TOKEN WITH GOOGLE ─────────────────────
    // This call checks the cryptographic signature against
    // Google's public keys. If the token is fake, expired,
    // or tampered with, this throws an error — caught below.
    const ticket = await client.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    // payload now contains verified data:
    // { sub: googleId, email, name, picture, ... }

    const { sub: googleId, email, name, picture } = payload;

    // ── FIND OR CREATE USER IN MONGODB ───────────────────
    let user = await User.findOne({ googleId });

    if (!user) {
      // First-time login — create a new user record
      user = await User.create({ googleId, email, name, picture });
      console.log(`New user registered: ${email}`);
    }

    // If this device saved a Gemini key before logging in, attach it
    // to the account now — so the user is never asked to re-enter it.
    try {
      await ApiKey.findOneAndUpdate(
        { deviceId: req.deviceId, userId: null },
        { $set: { userId: user._id } }
      );
    } catch (linkErr) {
      console.warn("API key link on login failed (non-blocking):", linkErr.message);
    }

    // ── ISSUE OUR OWN APP JWT ─────────────────────────────
    const token = generateAppToken(user._id);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture,
      },
    });

  } catch (error) {
    console.error("Google Auth Error:", error.message);
    return res.status(401).json({
      success: false,
      message: "Google authentication failed. Please try again.",
    });
  }
};

// GET /api/auth/me: validates the saved token and returns the current user.

export const getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("-__v");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    return res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        picture: user.picture,
      },
    });
  } catch (error) {
    console.error("Get Current User Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch user.",
    });
  }
};