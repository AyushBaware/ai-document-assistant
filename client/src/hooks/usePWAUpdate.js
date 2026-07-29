// ============================================================
// usePWAUpdate.js
//
// Service workers cache your JS/CSS aggressively (StaleWhileRevalidate).
// That means after you deploy a new version, an already-installed
// user's app could keep running OLD code until they fully close and
// reopen it. This hook surfaces a small "Update available" prompt
// instead, so they can refresh into the new version on demand.
// ============================================================

import { useRegisterSW } from "virtual:pwa-register/react";

export function usePWAUpdate() {
  const {
    needRefresh: [needRefresh],
    offlineReady: [offlineReady],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      // Check for a new version once an hour — cheap, and catches
      // updates for users who keep a tab open for a long time.
      if (registration) {
        setInterval(() => registration.update(), 60 * 60 * 1000);
      }
    },
  });

  return { needRefresh, offlineReady, updateServiceWorker };
}