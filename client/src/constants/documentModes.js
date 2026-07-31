// ============================================================
// documentModes.js
//
// Shared constants describing the app's AI modes and navigation
// items. Pulled out of UploadBox.jsx so any component that needs
// to know "what modes exist" reads from one single source of
// truth instead of duplicating this list.
// ============================================================

import { FiMessageCircle, FiZap, FiFileText, FiBookOpen } from "react-icons/fi";

export const ACCEPTED_EXTENSIONS = [
  ".pdf",
  ".doc",
  ".docx",
  ".ppt",
  ".pptx",
  ".txt",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
];

export const AI_MODES = [
  {
    type: "summary",
    label: "Summary",
    icon: "⚡",
    description: "Key points at a glance",
  },
  {
    type: "notes",
    label: "Notes",
    icon: "📋",
    description: "Revision-ready study notes",
  },
  {
    type: "explain",
    label: "Explain",
    icon: "🧠",
    description: "Deep concept walkthrough",
  },
];

// Shown as clickable starter pills in the full-screen chat when no
// messages exist yet — generic, document-agnostic prompts (no extra
// API call needed to generate these).
export const CHAT_SUGGESTIONS = [];

// Hamburger nav items for the full-screen view — "Chat" (type: null)
// plus the three AI modes. Real icon components, not emoji.
export const NAV_ITEMS = [
  { type: null, label: "Chat", Icon: FiMessageCircle },
  { type: "summary", label: "Summary", Icon: FiZap },
  { type: "notes", label: "Notes", Icon: FiFileText },
  { type: "explain", label: "Explain", Icon: FiBookOpen },
];