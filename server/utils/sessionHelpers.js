// ============================================================
// sessionHelpers.js
//
// Two small, focused utility functions used by sessionController.js.
// Kept separate so the controller stays readable — this is the
// same "separation of concerns" pattern you already use with
// extractText.js, createChunks.js, knowledgeStore.js etc.
// ============================================================

import Session from "../models/Session.js";

// ── AUTO-GENERATE A SESSION TITLE ────────────────────────────
// Turns ["AI Intro.pptx", "Ensemble methods.pptx"] into something
// readable like "AI Intro + Ensemble methods" for the sidebar,
// instead of asking the user to manually name every session.
const MAX_TITLE_LENGTH = 60;

export const generateSessionTitle = (fileNames) => {
  if (!fileNames || fileNames.length === 0) return "Untitled Session";

  // Strip extensions for a cleaner title — "AI Intro.pptx" → "AI Intro"
  const cleanNames = fileNames.map((name) =>
    name.replace(/\.(pdf|docx?|pptx?|txt|png|jpe?g|webp)$/i, "")
  );

  let title = cleanNames.join(" + ");

  if (title.length > MAX_TITLE_LENGTH) {
    title = title.slice(0, MAX_TITLE_LENGTH).trim() + "...";
  }

  return title;
};

// ── ENFORCE ROLLING WINDOW OF 20 SESSIONS PER USER ───────────
// Called AFTER creating a new session. Counts how many sessions
// this user has; if over the limit, deletes the oldest ones.
//
// WHY A ROLLING WINDOW (not time-based deletion)?
// As discussed — a user who uploads rarely shouldn't lose old
// sessions just because time passed. A user who uploads
// constantly shouldn't be allowed to grow storage unbounded.
// Capping by COUNT (not age) handles both cases correctly.
const SESSION_LIMIT_PER_USER = 20;

export const enforceSessionLimit = async (userId) => {
  const sessionCount = await Session.countDocuments({ userId });

  if (sessionCount > SESSION_LIMIT_PER_USER) {
    const excessCount = sessionCount - SESSION_LIMIT_PER_USER;

    // Find the oldest sessions beyond the limit and delete them.
    // Sorting by createdAt ascending = oldest first.
    const oldestSessions = await Session.find({ userId })
      .sort({ createdAt: 1 })
      .limit(excessCount)
      .select("_id");

    const idsToDelete = oldestSessions.map((s) => s._id);

    if (idsToDelete.length > 0) {
      await Session.deleteMany({ _id: { $in: idsToDelete } });
      console.log(`Rolling window: deleted ${idsToDelete.length} oldest session(s) for user ${userId}`);
    }
  }
};