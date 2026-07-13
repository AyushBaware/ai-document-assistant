// ============================================================
// GlossaryTerm.jsx
//
// Wraps a single hard word/phrase. Desktop: hover shows a small
// popup near the cursor (Google-define style). Mobile (no hover
// support): tap toggles the popup, tap elsewhere closes it.
// Rendered via a portal so it never gets clipped by the
// scrollable response containers.
// ============================================================

import { useState, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

const isTouchDevice = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(hover: none)").matches;

function GlossaryTerm({ term, definition, children }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ left: 0 });
  const spanRef = useRef(null);
  const touch = useRef(isTouchDevice());

  const computePosition = () => {
    const el = spanRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const placement = rect.top > 90 ? "top" : "bottom";
    const clampedLeft = Math.min(
      Math.max(rect.left + rect.width / 2, 140),
      window.innerWidth - 140
    );

    setCoords({
      left: clampedLeft,
      top: placement === "top" ? undefined : rect.bottom + 8,
      bottom: placement === "top" ? window.innerHeight - rect.top + 8 : undefined,
    });
  };

  const show = () => {
    computePosition();
    setOpen(true);
  };
  const hide = () => setOpen(false);

  useEffect(() => {
    if (!open) return;
    const handler = () => computePosition();
    window.addEventListener("scroll", handler, true);
    window.addEventListener("resize", handler);
    return () => {
      window.removeEventListener("scroll", handler, true);
      window.removeEventListener("resize", handler);
    };
  }, [open]);

  // Mobile: tap outside closes it.
  useEffect(() => {
    if (!open || !touch.current) return;
    const closeOnOutsideTap = (e) => {
      if (spanRef.current && !spanRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("touchstart", closeOnOutsideTap);
    return () => document.removeEventListener("touchstart", closeOnOutsideTap);
  }, [open]);

  const handleClick = (e) => {
    if (!touch.current) return;
    e.stopPropagation();
    setOpen((v) => {
      if (!v) computePosition();
      return !v;
    });
  };

  return (
    <span
      ref={spanRef}
      onMouseEnter={!touch.current ? show : undefined}
      onMouseLeave={!touch.current ? hide : undefined}
      onClick={handleClick}
      className="underline decoration-dotted decoration-cyan-400/50 underline-offset-2 cursor-help"
    >
      {children}
      {open &&
        createPortal(
          <span
            role="tooltip"
            style={{
              position: "fixed",
              left: coords.left,
              marginLeft: -130,
              top: coords.top,
              bottom: coords.bottom,
              maxWidth: 260,
            }}
            className="glossary-popup z-[100] pointer-events-none rounded-xl border border-white/10 bg-[#12161f] px-3 py-2 text-xs leading-5 text-gray-200 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
          >
            <span className="block font-semibold text-cyan-300 mb-0.5 capitalize">
              {term}
            </span>
            {definition}
          </span>,
          document.body
        )}
    </span>
  );
}

export default GlossaryTerm;