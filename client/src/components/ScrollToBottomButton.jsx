// ============================================================
// ScrollToBottomButton.jsx
//
// Floating "scroll to bottom" affordance, same behavior as
// Claude's own chat UI: hidden while already at/near the
// bottom of a scrollable container, fades in once the user
// scrolls up past a small threshold, and smooth-scrolls back
// down on click. Re-checks its own visibility whenever the
// passed `deps` change (new message, new generated content,
// loading state) so it never gets stuck visible or hidden
// after content streams in.
// ============================================================

import { useState, useEffect, useCallback } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiArrowDown } from "react-icons/fi";

const BOTTOM_THRESHOLD = 120;

function ScrollToBottomButton({ scrollRef, deps = [] }) {
  const [visible, setVisible] = useState(false);

  const checkPosition = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const isScrollable = el.scrollHeight > el.clientHeight + 10;
    setVisible(isScrollable && distanceFromBottom > BOTTOM_THRESHOLD);
  }, [scrollRef]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkPosition();
    el.addEventListener("scroll", checkPosition, { passive: true });
    window.addEventListener("resize", checkPosition);
    return () => {
      el.removeEventListener("scroll", checkPosition);
      window.removeEventListener("resize", checkPosition);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scrollRef.current]);

  // Recheck whenever new content lands (new message, new response,
  // loading toggling) — content height changes without a scroll event.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    checkPosition();
  }, deps);

  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.button
          initial={{ opacity: 0, y: 8, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.9 }}
          transition={{ duration: 0.15 }}
          onClick={scrollToBottom}
          title="Scroll to bottom"
          className="cursor-pointer w-9 h-9 rounded-full bg-white/10 border border-white/15 backdrop-blur-md flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/20 transition-all shadow-lg shadow-black/30"
        >
          <FiArrowDown className="text-base" />
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default ScrollToBottomButton;