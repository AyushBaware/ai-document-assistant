// ============================================================
// server.js
//
// SECURITY FIXES:
//
// 1. CORS RESTRICTED — previously cors() with no config meant
//    ANY website on the internet could call your API directly
//    from a user's browser (e.g. a malicious site could read
//    your API responses using a visitor's session). Now CORS
//    only allows requests from your own frontend's origin.
//
// 2. RATE LIMITING ADDED on /api/ai — without this, anyone
//    (or any script) could hammer your Gemini-calling endpoint
//    repeatedly, burning through API quota or costs with no
//    limit. express-rate-limit caps requests per IP per window.
//
// 3. HELMET ADDED — sets a collection of security-related HTTP
//    headers (prevents clickjacking, MIME-sniffing attacks,
//    etc.) with sensible defaults for an API server.
// ============================================================

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";

dotenv.config();

import connectDB from "./config/db.js";

import uploadRoutes from "./routes/uploadRoutes.js";
import aiRoutes from "./routes/aiRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import sessionRoutes from "./routes/sessionRoutes.js";
import apiKeyRoutes from "./routes/apiKeyRoutes.js";
import { assignDeviceId } from "./middleware/deviceMiddleware.js";

connectDB();

const app = express();

// ── SECURITY HEADERS ────────────────────────────────────────
app.use(helmet());

// ── CORS — restricted to known frontend origins only ───────
// In production, set CLIENT_URL in .env to your deployed
// frontend's exact URL. Falls back to localhost for dev.
const allowedOrigins = [
  process.env.CLIENT_URL || "http://localhost:5173",
];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. server-to-server,
      // curl, Postman) — only browsers send an Origin header
      // for cross-site requests, so this is safe for an API.
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    credentials: true,
    // REQUIRED: browsers hide custom response headers from JS by
    // default on cross-origin requests. Without this, the frontend
    // can never read X-Guest-Requests-Remaining — it silently comes
    // back undefined, which is why the badge only ever "caught up"
    // on a full page refresh instead of updating live.
    exposedHeaders: ["X-Guest-Requests-Remaining"],
  })
);

app.use(
  express.json({
    limit: "50mb",
  })
);

app.use(cookieParser());

// Assigns every visitor a stable, anonymous deviceId cookie —
// this is what makes guest (not-logged-in) usage possible at all.
app.use(assignDeviceId);

// ── RATE LIMITING on AI generation endpoint ─────────────────
// Prevents abuse / accidental runaway loops from exhausting
// your Gemini quota. 20 requests per 5 minutes per IP is
// generous for normal use (each "session" is at most 3 clicks
// — Summary/Notes/Explain) while blocking abuse.
const aiRateLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 20,
  message: {
    success: false,
    message: "Too many AI requests. Please wait a few minutes and try again.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use("/api/ai", aiRateLimiter);

// ── ROUTES ───────────────────────────────────────────────────
app.use("/api/upload", uploadRoutes);
app.use("/api/ai", aiRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/sessions", sessionRoutes);
app.use("/api/apikey", apiKeyRoutes);

app.get("/", (req, res) => {
  res.json({
    message: "AI Document Assistant API Running",
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});