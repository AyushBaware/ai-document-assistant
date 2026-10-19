// Purpose: Builds session titles and enforces each user's 20-session cap.

import Session from "../models/Session.js";

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

// Keep storage bounded without expiring sessions based on age.
const SESSION_LIMIT_PER_USER = 20;

export const enforceSessionLimit = async (userId) => {
  const sessionCount = await Session.countDocuments({ userId });

  if (sessionCount > SESSION_LIMIT_PER_USER) {
    const excessCount = sessionCount - SESSION_LIMIT_PER_USER;

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