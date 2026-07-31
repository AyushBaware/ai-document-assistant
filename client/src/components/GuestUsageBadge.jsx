// ============================================================
// GuestUsageBadge.jsx
//
// Purely presentational — all state/event logic now lives in
// useGuestUsage.js (App.jsx), so this component just renders
// whatever `remaining` it's given.
// ============================================================

import { createPortal } from "react-dom";

function GuestUsageBadge({ remaining }) {
  if (remaining === null || remaining === undefined) return null;

  // Portaled straight to document.body — this is the only way to
  // guarantee true viewport-relative "fixed" positioning regardless of
  // any ancestor animating via transform (Framer Motion's opacity/y
  // animations on App.jsx's root div do exactly this, which is what
  // was breaking this badge specifically once hideHero/hideChrome
  // changed that ancestor's box). z-[100] keeps it above FullScreenView
  // (z-50) and every modal, since it must stay visible in chat too.
  return createPortal(
    <div
      className="fixed bottom-4 left-4 z-[100] inline-flex w-fit max-w-fit items-center whitespace-nowrap px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 backdrop-blur-md select-none"
      data-tooltip="Free guest requests remaining"
      data-tooltip-align="start"
    >
      <span className={remaining <= 1 ? "text-amber-300 font-medium" : ""}>
        {remaining}/5
      </span>
      &nbsp;free requests left
    </div>,
    document.body
  );
}

export default GuestUsageBadge;