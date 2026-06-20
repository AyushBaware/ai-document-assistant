// ============================================================
// User.js
//
// WHAT THIS IS:
// A Mongoose SCHEMA — a blueprint that tells MongoDB exactly
// what shape a "user" document should have. MongoDB itself is
// schema-less (you could store anything), but Mongoose adds
// structure and validation on top, which prevents bugs like
// accidentally saving a user with no email.
//
// WHY THESE SPECIFIC FIELDS:
// googleId    — Google's unique, permanent ID for this person.
//               This is what we use to find "is this person
//               already registered" on every login — NOT email,
//               because emails can theoretically change.
// email       — shown in your UI, used for display purposes.
// name        — the user's display name from their Google profile.
// picture     — Google profile photo URL, for a nice UI avatar.
// createdAt   — automatically set once, never changes. Useful
//               for analytics later ("users joined this month").
//
// WHY NO PASSWORD FIELD?
// Google OAuth means Google verifies identity — we never see
// or store a password. This is exactly why OAuth is considered
// more secure for projects like this: there's no password
// database to ever leak.
// ============================================================

import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    googleId: {
      type: String,
      required: true,
      unique: true, // MongoDB enforces no two users share a googleId
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    name: {
      type: String,
      required: true,
    },
    picture: {
      type: String, // URL to Google profile photo
      default: "",
    },
  },
  {
    // Mongoose automatically adds createdAt and updatedAt fields
    // and keeps updatedAt current on every save. Saves us from
    // manually tracking timestamps ourselves.
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);

export default User;