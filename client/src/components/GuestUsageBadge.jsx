// ============================================================
// GuestUsageBadge.jsx
//
// Purely presentational — all state/event logic now lives in
// useGuestUsage.js (App.jsx), so this component just renders
// whatever `remaining` it's given.
// ============================================================

function GuestUsageBadge({ remaining }) {
  if (remaining === null || remaining === undefined) return null;

  return (
    <div
      className="fixed bottom-4 left-4 z-20 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-300 backdrop-blur-md select-none"
      title="Free guest requests remaining"
    >
      <span className={remaining <= 1 ? "text-amber-300 font-medium" : ""}>
        {remaining}/5
      </span>{" "}
      free requests left
    </div>
  );
}

export default GuestUsageBadge;