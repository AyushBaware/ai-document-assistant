// ============================================================
// authController.js
//
// WHAT THIS DOES — THE FULL FLOW EXPLAINED:
//
// 1. Frontend uses Google's Sign-In button. When the user
//    approves, Google gives the FRONTEND a "credential" —
//    this is actually a signed ID Token (a JWT made BY GOOGLE,
//    containing the user's verified email/name/picture).
//
// 2. Frontend sends that Google ID Token to OUR backend
//    (POST /api/auth/google).
//
// 3. OUR BACKEND must verify that token is genuinely from
//    Google and wasn't tampered with. We use Google's own
//    `google-auth-library` to do this verification — it
//    checks the token's cryptographic signature against
//    Google's public keys.
//
// 4. Once verified, we extract the user's googleId, email,
//    name, picture from the verified token payload.
//
// 5. We check MongoDB: does a User with this googleId already
//    exist?
//      - Yes → this is a returning user, just fetch them
//      - No  → this is a first-time user, create a new User
//              document in MongoDB
//
// 6. We issue OUR OWN JWT — signed with OUR secret key, NOT
//    Google's. This token contains just { userId: "..." } and
//    an expiry. THIS is the token the frontend will use for
//    all future authenticated requests to OUR backend.
//
// WHY ISSUE OUR OWN JWT INSTEAD OF REUSING GOOGLE'S?
// Google's ID token is short-lived (usually ~1 hour) and is
// meant only to prove identity AT THE MOMENT of login. Our
// own JWT lets us control the session length (e.g. 7 days)
// and doesn't depend on Google for every single request —
// much more efficient, and the standard pattern used by
// every real app implementing "Sign in with Google."
// ============================================================

import { OAuth2Client } from "google-auth-library";
import jwt from "jsonwebtoken";
import User from "../models/User.js";

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

// ============================================================
// POST /api/auth/google
// Receives Google's ID token from frontend, verifies it,
// creates/finds the user, returns our own JWT + user info.
// ============================================================

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

// ============================================================
// GET /api/auth/me
// Used to check "is this user still logged in" when the app
// loads. Frontend sends the saved JWT, this confirms it's
// still valid and returns the current user's info.
// Protected by authMiddleware.js (runs before this controller).
// ============================================================

export const getCurrentUser = async (req, res) => {
  try {
    // req.userId is attached by authMiddleware.js after
    // verifying the JWT — see that file for how this works
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