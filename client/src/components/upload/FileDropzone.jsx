// ============================================================
// FileDropzone.jsx
//
// The empty "select documents" state AND the file-review list
// (once files are picked, before/while processing). Renders
// `children` (the ModeSelector) at the end of the active state,
// same position it occupied inline in the original UploadBox.
// ============================================================

import { motion, AnimatePresence } from "framer-motion";
import { FiUploadCloud, FiPlus } from "react-icons/fi";
import { getFileIcon } from "../../utils/fileIcons";

function FileDropzone({
  hasAnyFiles,
  files,
  processedFileNames,
  needsProcessing,
  loading,
  error,
  removeFile,
  handleFilesChange,
  handleUpload,
  children,
}) {
  return (
    <AnimatePresence mode="wait">
      {/* EMPTY STATE */}
      {!hasAnyFiles && (
        <motion.div
          key="empty-state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
          className="flex flex-col items-center text-center"
        >
          <motion.div
            animate={{ y: [0, -6, 0] }}
            transition={{
              repeat: Infinity,
              duration: 3,
              ease: "easeInOut",
            }}
            className="w-20 h-20 rounded-full bg-cyan-500/10 border border-cyan-400/20 flex items-center justify-center shadow-[0_0_40px_rgba(34,211,238,0.12)]"
          >
            <FiUploadCloud className="text-4xl text-cyan-400" />
          </motion.div>

          <p className="mt-1 text-gray-500 text-xs">
            Drag & drop files here, or click to browse.
          </p>

          <label
            htmlFor="fileUpload"
            className="mt-8 cursor-pointer inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:scale-[1.03] active:scale-[0.98] transition-all duration-300 font-medium shadow-[0_0_25px_rgba(34,211,238,0.3)] text-white select-none"
          >
            <FiUploadCloud className="text-lg" />
            Select Documents / Images
          </label>

          <input
            id="fileUpload"
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
            onChange={handleFilesChange}
            className="hidden"
          />
        </motion.div>
      )}

      {/* ACTIVE STATE */}
      {hasAnyFiles && (
        <motion.div
          key="active-state"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <div className="flex items-center justify-between gap-3 mb-5">
            <h2 className="text-lg sm:text-xl font-semibold text-white truncate min-w-0 flex-1">
              {processedFileNames.length > 0 && !needsProcessing
                ? processedFileNames.length > 1
                  ? `${processedFileNames.length} documents ready`
                  : processedFileNames[0]
                : "Your files"}
            </h2>

            <label
              htmlFor="fileUploadPersistent"
              className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/[0.06] border border-white/10 hover:bg-white/10 transition-all text-sm text-gray-200 select-none shrink-0"
            >
              <FiPlus className="text-base" />
              Add files
            </label>
            <input
              id="fileUploadPersistent"
              type="file"
              multiple
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.png,.jpg,.jpeg,.webp"
              onChange={handleFilesChange}
              className="hidden"
            />
          </div>

          <AnimatePresence>
            {files.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6"
              >
                {files.map((file, index) => (
                  <motion.div
                    key={`${file.name}-${file.size}-${index}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.04 }}
                    className="p-4 rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-3 overflow-hidden min-w-0 flex-1">
                      <span className="text-2xl shrink-0">
                        {getFileIcon(file.name)}
                      </span>
                      <div className="overflow-hidden min-w-0">
                        <p className="text-sm text-white truncate font-medium">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(index)}
                      className="cursor-pointer w-8 h-8 rounded-lg bg-red-500/10 border border-red-400/20 hover:bg-red-500/25 transition-all text-red-300 flex items-center justify-center shrink-0 text-sm"
                    >
                      ✕
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {needsProcessing && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex justify-center mb-2"
              >
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleUpload}
                  disabled={loading}
                  className="cursor-pointer px-8 py-3 rounded-2xl bg-cyan-500/15 border border-cyan-400/25 hover:bg-cyan-500/25 transition-all shadow-[0_0_25px_rgba(34,211,238,0.1)] font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <span className="flex items-center gap-2">
                      <motion.span
                        animate={{ rotate: 360 }}
                        transition={{
                          repeat: Infinity,
                          duration: 1,
                          ease: "linear",
                        }}
                        className="inline-block w-4 h-4 border-2 border-cyan-400/40 border-t-cyan-400 rounded-full"
                      />
                      Processing...
                    </span>
                  ) : (
                    "Process Documents"
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {error && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 text-center text-red-400 text-sm"
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>

          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default FileDropzone;