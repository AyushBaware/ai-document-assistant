// Purpose: Detects service-worker updates and triggers app refresh.

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