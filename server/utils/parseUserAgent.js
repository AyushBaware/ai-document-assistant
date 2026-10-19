// Purpose: Parses browser and device details from user-agent strings.

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