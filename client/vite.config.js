// ============================================================
// vite.config.js
//
// FIXED: Added a server header override for
// Cross-Origin-Opener-Policy.
//
// WHY THIS WAS HAPPENING:
// Google's "Sign in with Google" button opens a popup window
// to handle the login, then uses window.postMessage() to send
// the result back to your main app window. Modern browsers
// enforce a security header called Cross-Origin-Opener-Policy
// (COOP) that, by default in some environments, isolates
// popups from their opener — this BLOCKS that postMessage
// call, producing the exact warning you saw.
//
// The login actually still succeeds (you saw it work, then the
// warning disappeared on refresh) because browsers are lenient
// about this specific case, but the warning indicates the
// communication channel is more fragile than it should be.
//
// THE FIX:
// Setting Cross-Origin-Opener-Policy to "same-origin-allow-popups"
// explicitly tells the browser: this page can open popups AND
// still receive postMessage from them. This is the exact header
// value Google's own documentation recommends for sites using
// Google Identity Services with popup-based sign-in.
// ============================================================

import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
});