// ============================================================
// ChatPanel.jsx
//
// Conversational "Ask Questions" UI. Keeps its own message
// history in local state — reset automatically whenever the
// `key` prop (selectedIds) changes in UploadBox, so switching
// which documents are selected starts a fresh conversation.
//
// Citations: each assistant message shows which source
// document(s) the answer was grounded in — builds trust that
// the answer isn't hallucinated.
// ============================================================

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FiSend, FiMessageCircle, FiMenu } from "react-icons/fi";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { askQuestion, askQuestionFromSession } from "../api/chatApi";

const MAX_QUESTION_LENGTH = 500;

function ChatPanel({
  selectedIds,
  isPreloadedSession,
  currentSessionId,
  geminiKey,
  token,
  initialMessages = [],
  suggestions = [],
  fullScreen = false,
  modeOptions = [],
  onSelectMode,
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const messagesContainerRef = useRef(null);
  const inputRef = useRef(null);

  // Scroll only the chat's own inner list — NOT the page.
  // scrollIntoView() was scrolling the whole document (since the
  // target sits deep in the page), which pushed the header off
  // screen every time the chat opened. Setting scrollTop directly
  // on the container fixes this without touching page scroll.
  useEffect(() => {
    const el = messagesContainerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, loading]);

  // Nice touch: focus the input the moment the panel opens.
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Caches answers by exact question text (case-insensitive) for
  // this chat session. Students often re-ask the same question —
  // this avoids burning another Gemini call for an identical repeat.
  // Resets naturally whenever ChatPanel remounts (new doc selection).
  const answerCacheRef = useRef(new Map());

  const sendMessage = async (rawQuestion) => {
    const question = rawQuestion.trim();
    if (!question || loading) return;

    const cacheKey = question.toLowerCase();
    const cached = answerCacheRef.current.get(cacheKey);

    setInput("");
    setError("");
    setMessages((prev) => [...prev, { role: "user", content: question }]);

    if (cached) {
      // Instant, zero-cost repeat answer — no API call.
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: cached.answer, sources: cached.sources, cached: true },
      ]);
      return;
    }

    setLoading(true);

    try {
      // Only the last few exchanges are sent — keeps every
      // request small regardless of how long the chat gets.
      const history = messages
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      // Persist to MongoDB whenever a session exists (fresh upload that
      // just auto-saved, OR a reopened past session) — isPreloadedSession
      // only distinguishes where document content is read from, it must
      // not gate whether the conversation gets saved. Previously this
      // required isPreloadedSession === true, which meant fresh-upload
      // chats (session created, but not "preloaded") were silently
      // never persisted and vanished on refresh.
      let data;
      if (currentSessionId && token) {
        data = await askQuestionFromSession(
          question,
          currentSessionId,
          history,
          geminiKey,
          token,
        );
      } else {
        data = await askQuestion(question, selectedIds, history, geminiKey);
      }

      answerCacheRef.current.set(cacheKey, {
        answer: data.answer,
        sources: data.sources || [],
      });

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.answer, sources: data.sources || [] },
      ]);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to get an answer. Please try again.",
      );
      setMessages((prev) => prev.slice(0, -1)); // remove the pending question on failure
    } finally {
      setLoading(false);
    }
  };

  const handleSend = () => sendMessage(input);

  const handleSuggestionClick = (suggestion) => sendMessage(suggestion);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div
      className={`flex flex-col overflow-hidden ${
        fullScreen
          ? "h-full"
          : "border border-white/10 bg-gradient-to-b from-white/[0.05] to-white/[0.01] backdrop-blur-2xl rounded-2xl h-[70vh] max-h-[600px]"
      }`}
    >
      {!fullScreen && (
        <div className="px-4 sm:px-5 py-3.5 border-b border-white/10 flex items-center gap-3">
          <FiMessageCircle className="text-cyan-400 text-lg" />
          <h3 className="text-sm font-semibold text-white">Ask Questions</h3>
        </div>
      )}

      <div className="relative flex-1 min-h-0">
        <div className="pointer-events-none absolute top-0 inset-x-0 h-6 sm:h-8 z-10 backdrop-blur-sm [mask-image:linear-gradient(to_bottom,black,transparent)]" />
        <div
          ref={messagesContainerRef}
          className={`h-full overflow-y-auto px-4 sm:px-5 py-4 space-y-4 ${
            fullScreen ? "max-w-3xl w-full mx-auto" : ""
          }`}
        >
        <AnimatePresence>
          {messages.length === 0 && (
            <motion.div
              key="chat-empty-state"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8, transition: { duration: 0.2 } }}
              className="flex flex-col items-center justify-center h-full py-10 gap-5"
            >
              <p className="text-gray-500 text-sm text-center max-w-sm px-4">
                Ask anything about your document(s) — answers are grounded
                only in what they actually contain.
              </p>

              {/* MOBILE: mode buttons — the hamburger isn't obvious to a
                  first-time user, so surface Summary/Notes/Explain here too. */}
              {modeOptions.length > 0 && (
                <div className="sm:hidden flex flex-col items-center gap-3 w-full px-4">
                  <div className="grid grid-cols-3 gap-2 w-full max-w-sm">
                    {modeOptions.map((item) => {
                      const ModeIcon = item.Icon;
                      return (
                        <button
                          key={item.label}
                          onClick={() => onSelectMode && onSelectMode(item.type)}
                          className="flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl bg-white/[0.05] border border-white/10 text-gray-200 hover:bg-white/10 hover:border-cyan-400/30 transition-all"
                        >
                          <ModeIcon className="text-base text-cyan-300" />
                          <span className="text-xs">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="text-[11px] text-gray-600 text-center flex items-center gap-1">
                    <FiMenu className="text-xs" />
                    Also available anytime from the menu, top-left
                  </p>
                </div>
              )}

              {/* DESKTOP: sidebar already covers navigation, so keep the
                  original question suggestions here instead. */}
              {suggestions.length > 0 && (
                <div className="hidden sm:flex flex-wrap justify-center gap-2 max-w-lg px-2">
                  {suggestions.map((s, i) => (
                    <button
                      key={i}
                      onClick={() => handleSuggestionClick(s)}
                      className="text-xs sm:text-sm px-3.5 py-2 rounded-full bg-white/[0.05] border border-white/10 text-gray-300 hover:bg-white/10 hover:border-cyan-400/30 hover:text-white transition-all"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"} group`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-6 relative ${
                msg.role === "user"
                  ? "bg-cyan-500/20 border border-cyan-400/30 text-white"
                  : "bg-white/[0.05] border border-white/10 text-gray-200"
              }`}
            >
              {msg.role === "assistant" && (
                <button
                  onClick={() => navigator.clipboard.writeText(msg.content)}
                  className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity w-6 h-6 rounded-full bg-white/10 border border-white/10 text-gray-400 hover:text-white hover:bg-white/20 flex items-center justify-center text-xs"
                  title="Copy answer"
                >
                  ⧉
                </button>
              )}
              {msg.role === "assistant" ? (
                <div className="prose prose-sm sm:prose lg:prose-lg prose-invert max-w-none prose-headings:text-white prose-strong:text-white prose-code:text-cyan-300 prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none prose-a:text-cyan-400">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {msg.content}
                  </ReactMarkdown>
                </div>
              ) : (
                <p className="whitespace-pre-wrap">{msg.content}</p>
              )}
              {msg.cached && (
                <p className="text-[10px] text-cyan-400/70 mt-1">⚡ Instant — repeated question</p>
              )}
              {msg.sources && msg.sources.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2 pt-2 border-t border-white/10">
                  {msg.sources.map((src, j) => (
                    <span
                      key={j}
                      className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-400/20 text-cyan-300"
                    >
                      📄 {src}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white/[0.05] border border-white/10 rounded-2xl px-4 py-2.5">
              <motion.div
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ repeat: Infinity, duration: 1.2 }}
                className="text-sm text-gray-400"
              >
                Thinking...
              </motion.div>
            </div>
          </div>
        )}
        </div>
      </div>

      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="px-4 text-xs text-red-400 text-center pb-2"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>

      <div
        className={`px-4 sm:px-5 py-3.5 border-t border-white/10 flex items-end gap-2 ${
          fullScreen ? "max-w-3xl w-full mx-auto" : ""
        }`}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value.slice(0, MAX_QUESTION_LENGTH))}
          onKeyDown={handleKeyDown}
          rows={1}
          placeholder="Ask a question about your document..."
          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-cyan-500/50 resize-none"
        />
        <button
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="w-10 h-10 shrink-0 rounded-xl bg-cyan-500/20 border border-cyan-400/30 flex items-center justify-center text-cyan-300 hover:bg-cyan-500/30 transition disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <FiSend className="text-base" />
        </button>
      </div>
    </div>
  );
}

export default ChatPanel;
