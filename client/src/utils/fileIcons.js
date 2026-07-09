// ============================================================
// fileIcons.js
//
// Maps a file name's extension to a display emoji. Pure utility
// function — no state, no side effects — so it lives in utils/
// rather than components/.
// ============================================================

export const getFileIcon = (name = "") => {
  const ext = name.split(".").pop().toLowerCase();
  if (ext === "pdf") return "📄";
  if (["ppt", "pptx"].includes(ext)) return "📊";
  if (["doc", "docx"].includes(ext)) return "📝";
  if (ext === "txt") return "📃";
  if (["png", "jpg", "jpeg", "webp"].includes(ext)) return "🖼️";
  return "📁";
};