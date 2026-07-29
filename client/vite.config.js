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
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: "auto",

      // Don't run the service worker during `npm run dev` — this is
      // what usually causes "the app feels slow after adding PWA"
      // complaints; SW + HMR fighting each other in dev is the culprit,
      // not PWA itself. Production build is unaffected.
      devOptions: {
        enabled: false,
      },

      includeAssets: ["favicon.svg", "robots.txt", "apple-touch-icon.png"],

      manifest: {
        name: "DocuMind AI",
        short_name: "DocuMind AI",
        description:
          "Upload documents and get instant AI-powered summaries, notes, explanations, and a chat assistant.",
        theme_color: "#030712",
        background_color: "#030712",
        display: "standalone",
        orientation: "portrait-primary",
        scope: "/",
        start_url: "/",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          {
            src: "/pwa-512x512-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
        ],
      },

      workbox: {
        // Precache only real build output — JS/CSS/HTML/icons.
        globPatterns: ["**/*.{js,css,html,ico,svg,png,woff2}"],

        // CRITICAL: never let the SW's navigation fallback intercept
        // API routes. Without this, a failed/offline API call could
        // silently resolve to your index.html instead of erroring.
        navigateFallbackDenylist: [/^\/api\//],

        runtimeCaching: [
          // ── YOUR BACKEND API — NEVER CACHED ─────────────────────
          // Chat answers, AI generation, sessions, auth — all of this
          // is dynamic and often user-specific (JWT-gated). Caching
          // any of it would mean stale or cross-user data. This rule
          // makes the service worker a complete no-op for every
          // /api/* request — same network behavior as if PWA didn't
          // exist at all.
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/api/"),
            handler: "NetworkOnly",
          },

          // Google's own auth endpoints — never touched by our SW.
          {
            urlPattern: ({ url }) =>
              url.origin.includes("google.com") ||
              url.origin.includes("googleapis.com"),
            handler: "NetworkOnly",
          },

          // ── STATIC JS/CSS ────────────────────────────────────────
          // Serve from cache instantly, but re-fetch in the background
          // and swap in next load — fast AND never permanently stale.
          {
            urlPattern: ({ request }) =>
              request.destination === "script" ||
              request.destination === "style",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "static-resources" },
          },

          // ── IMAGES/ICONS/FONTS ───────────────────────────────────
          // These never change per-deploy (hashed filenames), so a
          // hard cache-first is both safe and fastest.
          {
            urlPattern: ({ request }) =>
              request.destination === "image" ||
              request.destination === "font",
            handler: "CacheFirst",
            options: {
              cacheName: "static-assets",
              expiration: { maxEntries: 80, maxAgeSeconds: 30 * 24 * 60 * 60 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  },
});