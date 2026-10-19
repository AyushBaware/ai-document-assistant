// Purpose: Defines the MongoDB schema for authenticated users.

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