import { useState, useRef, useCallback, createElement } from "react";
import { createPortal } from "react-dom";

const SHOW_DELAY_MS = 500;

// ============================================================
// useHoverTooltip.js
//
// Portal-based hover tooltip for icon/row buttons that live
// inside a scrollable (overflow-y-auto) container — e.g. the
// session history list, the document checklist, the
// notifications dropdown. CSS-only tooltips (data-tooltip
// attribute) get clipped by those containers because
// overflow-x is silently forced to "auto" whenever overflow-y
// isn't "visible" — there's no CSS-only way around that.
//
// Rendering into document.body sidesteps the clipping entirely
// and lets z-index actually mean "above everything".
//
// Call ONCE per component; reuse showTooltip/hideTooltip across
// as many rows/buttons as needed (only one tooltip can ever be
// visible at a time, since a person can only hover one thing).
// ============================================================
export function useHoverTooltip() {
  const [tooltip, setTooltip] = useState(null);
  const timerRef = useRef(null);

  const showTooltip = useCallback((event, label, { position = "top", align = "center" } = {}) => {
    const rect = event.currentTarget.getBoundingClientRect();
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const GAP = 8;
      let top;
      let left;
      let transform;

      if (position === "right") {
        top = rect.top + rect.height / 2;
        left = rect.right + GAP;
        transform = "translateY(-50%)";
      } else if (position === "bottom") {
        top = rect.bottom + GAP;
        left = align === "start" ? rect.left : align === "end" ? rect.right : rect.left + rect.width / 2;
        transform = align === "start" ? "none" : align === "end" ? "translateX(-100%)" : "translateX(-50%)";
      } else {
        // "top" (default)
        top = rect.top - GAP;
        left = align === "start" ? rect.left : align === "end" ? rect.right : rect.left + rect.width / 2;
        transform =
          align === "start" ? "translateY(-100%)" : align === "end" ? "translate(-100%, -100%)" : "translate(-50%, -100%)";
      }

      // Clamp to the viewport so the tooltip can never render
      // off-screen, regardless of where its trigger sits.
      left = Math.min(Math.max(left, 8), window.innerWidth - 8);
      top = Math.min(Math.max(top, 8), window.innerHeight - 8);

      setTooltip({ label, top, left, transform });
    }, SHOW_DELAY_MS);
  }, []);

  const hideTooltip = useCallback(() => {
    clearTimeout(timerRef.current);
    setTooltip(null);
  }, []);

  const tooltipPortal = tooltip
    ? createPortal(
        createElement(
          "span",
          {
            role: "tooltip",
            style: { position: "fixed", top: tooltip.top, left: tooltip.left, transform: tooltip.transform },
            className:
              "z-[9999] pointer-events-none whitespace-nowrap max-w-[240px] overflow-hidden text-ellipsis rounded-lg border border-white/10 bg-[#0d1117] px-2.5 py-1.5 text-[11px] font-medium text-gray-200 shadow-[0_8px_24px_rgba(0,0,0,0.4)]",
          },
          tooltip.label,
        ),
        document.body,
      )
    : null;

  return { showTooltip, hideTooltip, tooltipPortal };
}