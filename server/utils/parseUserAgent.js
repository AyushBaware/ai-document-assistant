// ============================================================
// parseUserAgent.js
//
// Lightweight, dependency-free User-Agent parser used only to
// give the ORIGINAL key owner anonymous context about a
// collision — e.g. "Chrome on Windows" — never anything that
// identifies the other person (no IP, no username, no userId).
//
// Order matters below: Chrome, Edge, and Opera all include a
// "Safari/" compatibility token in their real User-Agent string,
// so Safari must be checked LAST, or every Chrome user would be
// wrongly reported as Safari. Same logic for iOS vs Mac OS X —
// an iPhone's UA also matches "Mac OS X", so iOS is checked first.
// ============================================================

const BROWSER_PATTERNS = [
  { name: "Edge", regex: /Edg\// },
  { name: "Opera", regex: /OPR\// },
  { name: "Chrome", regex: /Chrome\// },
  { name: "Firefox", regex: /Firefox\// },
  { name: "Safari", regex: /Safari\// },
];

const OS_PATTERNS = [
  { name: "Android", regex: /Android/ },
  { name: "iOS", regex: /iPhone|iPad|iPod/ },
  { name: "Windows", regex: /Windows NT/ },
  { name: "Mac", regex: /Mac OS X/ },
  { name: "Linux", regex: /Linux/ },
];

export const parseUserAgent = (userAgent = "") => {
  if (!userAgent) return "an unrecognized browser on an unrecognized device";

  const browser =
    BROWSER_PATTERNS.find((b) => b.regex.test(userAgent))?.name ||
    "an unrecognized browser";
  const os =
    OS_PATTERNS.find((o) => o.regex.test(userAgent))?.name ||
    "an unrecognized device";

  return `${browser} on ${os}`;
};