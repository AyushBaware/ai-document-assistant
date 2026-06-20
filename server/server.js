// ============================================================
// server.js
//
// WHAT CHANGED FROM PHASE 2:
// Added sessionRoutes mounted at /api/sessions.
// Everything else is unchanged.
// ============================================================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

import connectDB from "./config/db.js";

import uploadRoutes from "./routes/uploadRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";

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
app.use("/api/sessions", sessionRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "AI Document Assistant API Running",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});