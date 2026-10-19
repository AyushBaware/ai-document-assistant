// Purpose: Creates readable display names for uploaded documents.

const MAX_LINES_TO_SCAN = 40;
const MIN_TITLE_LENGTH = 4;
const MAX_TITLE_LENGTH = 70;

// Lines matching these patterns are almost never real titles —
// page numbers, system notes, separators, bare chapter labels.
const NOISE_PATTERNS = [
  /^\[SYSTEM NOTE/i,
  /^page\s+\d+/i,
  /^\d+\s*$/,
  /^[-_=~*#]{3,}$/,
  /^table of contents$/i,
  /^contents$/i,
  /^chapter\s+\d+$/i,
];

const looksLikeNoise = (line) => {
  if (NOISE_PATTERNS.some((re) => re.test(line))) return true;

  // Mostly punctuation/symbols rather than actual words
  const letters = line.replace(/[^a-zA-Z]/g, "").length;
  if (letters < line.length * 0.4) return true;

  return false;
};

const stripFileExtension = (fileName = "") =>
  fileName.replace(/\.[^/.]+$/, "");

export const generateDisplayName = (extractedText, fallbackFileName) => {
  const fallback = stripFileExtension(fallbackFileName) || "Untitled Document";

  if (!extractedText || !extractedText.trim()) return fallback;

  const lines = extractedText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .slice(0, MAX_LINES_TO_SCAN);

  for (const line of lines) {
    if (line.length < MIN_TITLE_LENGTH) continue;
    if (looksLikeNoise(line)) continue;

    let title = line;
    if (title.length > MAX_TITLE_LENGTH) {
      title = title.slice(0, MAX_TITLE_LENGTH).trim() + "...";
    }
    title = title.replace(/[:\-–—]+$/, "").trim();

    if (title.length >= MIN_TITLE_LENGTH) {
      return title;
    }
  }

  return fallback;
};