// ============================================================
// MobileNavMenu.jsx
//
// The hamburger dropdown panel shown in the full-screen view's
// top bar on mobile — nav items (Chat/Summary/Notes/Explain)
// plus a document checklist when more than one file is loaded.
// ============================================================

import { motion, AnimatePresence } from "framer-motion";
import { NAV_ITEMS } from "../../constants/documentModes";

function MobileNavMenu({
  menuOpen,
  setMenuOpen,
  activeMode,
  handleNavSelect,
  selectedIds,
  cachedResults,
  processedDocs,
  setCachedResults,
  setSelectedIds,
}) {
  return (
    <AnimatePresence>
      {menuOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMenuOpen(false)}
            className="fixed inset-0 z-10 bg-black/40"
          />
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-14 left-4 z-20 w-64 bg-[#0d1117] border border-white/10 rounded-2xl p-2 shadow-xl"
          >
            {NAV_ITEMS.map((item) => {
              const isActive = item.type === activeMode;
              const NavIcon = item.Icon;
              const cacheKey =
                item.type !== null
                  ? `${item.type}_${[...selectedIds].sort().join(",")}`
                  : null;
              return (
                <button
                  key={item.label}
                  onClick={() => handleNavSelect(item.type)}
                  disabled={item.type !== null && selectedIds.length === 0}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                    isActive
                      ? "bg-cyan-500/15 text-cyan-300"
                      : "text-gray-300 hover:bg-white/[0.06]"
                  }`}
                >
                  <NavIcon className="text-base shrink-0" />
                  <span className="flex-1 text-left">{item.label}</span>
                  {cacheKey && cachedResults[cacheKey] && (
                    <span
                      className="w-1.5 h-1.5 rounded-full bg-green-400"
                      title="Cached"
                    />
                  )}
                </button>
              );
            })}

            {processedDocs.length > 1 && (
              <div className="mt-2 pt-2 border-t border-white/10 px-1">
                <p className="text-[11px] text-gray-500 px-2 mb-1.5">
                  Documents
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
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
                          onChange={() => {
                            // Cache is already scoped per-selection via its
                            // key — no need to wipe everything on toggle.
                            setSelectedIds((prev) =>
                              isSelected
                                ? prev.filter((id) => id !== doc.id)
                                : [...prev, doc.id],
                            );
                          }}
                          className="w-3.5 h-3.5 accent-cyan-400 shrink-0"
                        />
                        <span
                          className="text-xs text-gray-300 truncate"
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
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

export default MobileNavMenu;