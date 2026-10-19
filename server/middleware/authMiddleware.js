// Purpose: Verifies required or optional JWT authentication for requests.

import jwt from "jsonwebtoken";

// ── REQUIRED AUTH ────────────────────────────────────────────
// Use on routes where login is mandatory.
export const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization; // "Bearer <token>"

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No authentication token provided. Please log in.",
      });
    }

    const token = authHeader.split(" ")[1]; // extract token after "Bearer "

    // jwt.verify checks the signature using our secret AND
    // checks the token hasn't expired. Throws if either fails.
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.userId = decoded.userId; // attach for the next function to use
    next(); // continue to the actual route controller

  } catch (error) {
    return res.status(401).json({
      success: false,
      message: "Invalid or expired session. Please log in again.",
    });
  }
};

// ── OPTIONAL AUTH ────────────────────────────────────────────
// Use on routes that work for both logged-in and anonymous
// users. Never blocks the request — just enriches it with
// req.userId if a valid token happens to be present.
export const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      req.userId = null;
      return next();
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId;
    next();

  } catch (error) {
    // Token was present but invalid/expired — treat as
    // anonymous rather than blocking the request.
    req.userId = null;
    next();
  }
};