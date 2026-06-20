// ============================================================
// server.js
//
// WHAT CHANGED FROM YOUR ORIGINAL:
// 1. Added connectDB() call — connects to MongoDB Atlas on
//    server startup, before accepting any requests.
// 2. Added authRoutes mounted at /api/auth
//
// Everything else (uploadRoutes, aiRoutes, CORS, JSON parsing)
// is identical to your original file.
// ============================================================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import connectDB from "./config/db.js";

import uploadRoutes from "./routes/uploadRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import authRoutes from "./routes/authRoutes.js";

// Connect to MongoDB Atlas before the server starts handling
// requests. If this fails, db.js exits the process with a
// clear error — better than a server that "works" but silently
// can't save anything.
connectDB();

const app = express();

app.use(cors());

app.use(
  express.json({
    limit: "50mb",
  })
);

app.use("/api/upload", uploadRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/auth", authRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "AI Document Assistant API Running",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});