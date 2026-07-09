// ============================================================
// DesktopSidebar.jsx
//
// The collapsible left nav shown inside the full-screen view on
// desktop — Chat/Summary/Notes/Explain nav items plus the
// session history list. Hidden on mobile (the hamburger dropdown
// in MobileNavMenu covers navigation there instead).
// ============================================================

import { FiChevronLeft, FiChevronRight, FiTrash2 } from "react-icons/fi";
import { NAV_ITEMS } from "../../constants/documentModes";

function DesktopSidebar({
  sidebarOpen,
  setSidebarOpen,
  activeMode,
  selectedIds,
  cachedResults,
  handleNavSelect,
  user,
  deskSessionsLoading,
  deskSessions,
  currentSessionId,
  loadSessionById,
  handleDeleteDeskSession,
}) {
  return (
    <div
      className={`hidden sm:flex flex-col border-r border-white/10 shrink-0 transition-all duration-200 ${
        sidebarOpen ? "w-64" : "w-16"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
        {sidebarOpen && (
          <span className="text-sm font-semibold text-white px-1 truncate">
            DocuMind AI
          </span>
        )}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all shrink-0"
          title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
        >
          {sidebarOpen ? (
            <FiChevronLeft className="text-base" />
          ) : (
            <FiChevronRight className="text-base" />
          )}
        </button>
      </div>

      <div className="p-2 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = item.type === activeMode;
          const NavIcon = item.Icon;
          // Same cache-key logic as the mobile hamburger dropdown —
          // a green dot means this mode already has a generated
          // response for the currently selected document(s).
          const cacheKey =
            item.type !== null
              ? `${item.type}_${[...selectedIds].sort().join(",")}`
              : null;
          const isGenerated = cacheKey && cachedResults[cacheKey];
          return (
            <button
              key={item.label}
              onClick={() => handleNavSelect(item.type)}
              disabled={item.type !== null && selectedIds.length === 0}
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                isActive
                  ? "bg-cyan-500/15 text-cyan-300"
                  : "text-gray-300 hover:bg-white/[0.06]"
              } ${sidebarOpen ? "" : "justify-center"}`}
              title={item.label}
            >
              <NavIcon className="text-base shrink-0" />
              {sidebarOpen && <span className="flex-1 text-left">{item.label}</span>}
              {isGenerated && (
                <span
                  className={`w-1.5 h-1.5 rounded-full bg-green-400 shrink-0 ${
                    sidebarOpen ? "" : "absolute top-1.5 right-1.5"
                  }`}
                  title="Already generated"
                />
              )}
            </button>
          );
        })}
      </div>

      {sidebarOpen && user && (
        <div className="flex-1 min-h-0 flex flex-col mt-2 border-t border-white/10 pt-2">
          <p className="text-[11px] text-gray-500 px-4 mb-1.5">History</p>
          <div className="flex-1 min-h-0 overflow-y-auto px-2 space-y-1">
            {deskSessionsLoading && (
              <p className="text-xs text-gray-600 px-2 py-2">Loading...</p>
            )}
            {!deskSessionsLoading && deskSessions.length === 0 && (
              <p className="text-xs text-gray-600 px-2 py-2">
                No saved sessions yet.
              </p>
            )}
            {deskSessions.map((s) => {
              const isActiveSession = s.id === currentSessionId;
              return (
                <div
                  key={s.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => loadSessionById(s.id)}
                  className={`group flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                    isActiveSession
                      ? "bg-white/10"
                      : "hover:bg-white/[0.06]"
                  }`}
                >
                  <span
                    className={`text-xs truncate ${
                      isActiveSession
                        ? "text-white font-semibold"
                        : "text-gray-300"
                    }`}
                  >
                    {s.title}
                  </span>
                  <button
                    onClick={(e) => handleDeleteDeskSession(e, s.id)}
                    className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity shrink-0"
                    title="Delete session"
                  >
                    <FiTrash2 className="text-xs" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default DesktopSidebar;