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
  processedDocs,
  setSelectedIds,
}) {
  return (
    <div
      className={`hidden sm:flex flex-col border-r border-white/10 shrink-0 transition-all duration-200 ${
        sidebarOpen ? "w-64 lg:w-72" : "w-16"
      }`}
    >
      <div className="flex items-center justify-between px-3 py-3 border-b border-white/10">
        {sidebarOpen && (
          <span className="text-lg font-bold text-white px-1 truncate tracking-tight">
            DocuMind AI
          </span>
        )}
        <button
          onClick={() => setSidebarOpen((v) => !v)}
          className="cursor-pointer w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all shrink-0"
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
              className={`relative w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all cursor-pointer cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
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

      {/* CHAT-ONLY DOCUMENT SCOPING — minimal checklist so a user can
          restrict "Ask Questions" to a subset of the session's files.
          Scoped to activeMode === null (Chat) only: Summary/Notes/Explain
          don't currently honor per-document selection for a reopened
          session, so surfacing checkboxes there would be misleading. */}
      {sidebarOpen && processedDocs.length > 1 && (
        <div className="px-2 pt-2 pb-1 border-t border-white/10 mt-2">
          <p
            className="text-[12px] font-medium text-gray-500 px-2 mb-1.5 cursor-help"
            title="Answers are generated only from checked files"
          >
            Documents
          </p>
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {processedDocs.map((doc) => {
              const isSelected = selectedIds.includes(doc.id);
              return (
                <label
                  key={doc.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/[0.06] cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() =>
                      setSelectedIds((prev) =>
                        isSelected
                          ? prev.filter((id) => id !== doc.id)
                          : [...prev, doc.id],
                      )
                    }
                    className="w-4 h-4 accent-cyan-400 shrink-0"
                  />
                  <span
                    className="text-sm text-gray-300 truncate"
                    title={doc.fileName}
                  >
                    {doc.fileName}
                  </span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {sidebarOpen && user && (
        <div className="flex-1 min-h-0 flex flex-col mt-2 border-t border-white/10 pt-2">
          <p className="text-[12px] font-medium text-gray-500 px-4 mb-1.5">History</p>
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
                    className={`text-[13px] truncate ${
                      isActiveSession
                        ? "text-white font-semibold"
                        : "text-gray-300"
                    }`}
                  >
                    {s.title}
                  </span>
                  <button
                    onClick={(e) => handleDeleteDeskSession(e, s.id)}
                    className="cursor-pointer opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity shrink-0"
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